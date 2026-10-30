import { listProducts, getStock } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { posPriceSheet } from "../actions";
import { PosTerminal, type PosCategory, type PosCustomer, type PosItem, type PosRecentSale } from "./terminal";

export const metadata = { title: "POS" };

/**
 * Till data comes straight from the shared catalogue, stock and customer tables. The page is
 * re-rendered in place by live updates (LiveRefresh in the admin shell), so stock shown here
 * follows website sales without reloading.
 */
export default async function PosPage() {
  const supabase = await createClient();
  const [products, { data: customers }, { data: wholesale }, { data: tier }, { data: cats }, { data: recent }, sheet, store] = await Promise.all([
    listProducts(),
    supabase.from("profiles").select("id, full_name, phone, email, loyalty_points").eq("role", "customer").order("full_name"),
    supabase.from("wholesale_accounts").select("profile_id, business_name"),
    supabase.from("pricing_tiers").select("min_order_quantity").eq("code", "wholesale").single(),
    supabase.from("categories").select("slug, name, sort_order, parent:parent_id(slug)").eq("is_active", true).order("sort_order"),
    supabase.from("orders").select("id, order_number, customer_name, channel, total_amount, created_at, payments(method)")
      .not("created_by", "is", null).neq("channel", "online").order("created_at", { ascending: false }).limit(10),
    posPriceSheet(null),
    getStoreSettings(),
  ]);
  const stock = await getStock(products.flatMap((p) => p.variants.map((v) => v.id)));
  const wholesaleBy = new Map((wholesale ?? []).map((w) => [w.profile_id, w.business_name]));

  const items: PosItem[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      name: p.name,
      variantName: v.name ?? v.size ?? v.shade ?? v.hair_length ?? v.color ?? null,
      image: p.image,
      category: p.category.slug,
      group: p.category.parentSlug ?? p.category.slug,
      retail: v.price,
      available: stock[v.id]?.available ?? 0,
      low: stock[v.id]?.low ?? false,
    })),
  );
  // Top-level groups first, then hair's sub-categories (Wigs, Braids…), as on the shop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (cats ?? []).map((c: any) => ({ slug: c.slug as string, name: c.name as string, parent: (c.parent?.slug ?? null) as string | null }));
  const used = new Set(items.flatMap((i) => [i.category, i.group]));
  const categories: PosCategory[] = [
    ...all.filter((c) => !c.parent && used.has(c.slug)),
    ...all.filter((c) => c.parent && used.has(c.slug)),
  ].map(({ slug, name }) => ({ slug, name }));

  const posCustomers: PosCustomer[] = (customers ?? []).map((c) => ({
    id: c.id, name: c.full_name ?? "", phone: c.phone ?? "", email: c.email ?? "", points: c.loyalty_points,
    business: wholesaleBy.get(c.id) ?? null,
  }));
  const recentSales: PosRecentSale[] = (recent ?? []).map((o) => ({
    id: o.id, number: o.order_number, customer: o.customer_name ?? "Walk-in customer", channel: o.channel, total: Number(o.total_amount),
    at: o.created_at, methods: [...new Set(((o.payments as { method: string }[] | null) ?? []).map((p) => p.method))],
  }));

  return (
    <PosTerminal items={items} categories={categories} customers={posCustomers} walkInSheet={sheet.ok ? sheet.data : {}}
      threshold={tier?.min_order_quantity ?? 10} recentSales={recentSales} store={store} />
  );
}
