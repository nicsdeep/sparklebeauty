import { listProducts, getStock } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { getProfile } from "@/lib/auth";
import type { TaxType } from "@/lib/tax";
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
  const [products, { data: customers }, { data: wholesale }, { data: tier }, { data: cats }, { data: recent }, sheet, store, { data: rates }] = await Promise.all([
    listProducts(),
    supabase.from("profiles").select("id, full_name, phone, email, loyalty_points").eq("role", "customer").order("full_name"),
    supabase.from("wholesale_accounts").select("profile_id, business_name"),
    supabase.from("pricing_tiers").select("min_order_quantity").eq("code", "wholesale").single(),
    supabase.from("categories").select("slug, name, sort_order, parent:parent_id(slug)").eq("is_active", true).order("sort_order"),
    supabase.from("orders").select("id, order_number, customer_name, channel, total_amount, created_at, payments(method)")
      .not("created_by", "is", null).neq("channel", "online").order("created_at", { ascending: false }).limit(10),
    posPriceSheet(null),
    getStoreSettings(),
    supabase.rpc("variant_tax_rates"),
  ]);
  const me = await getProfile();
  const cashier = me?.full_name ?? null;

  // Product activity for the default view (real sales, not cancelled): Quick Picks = best sellers over
  // 90 days, Fast-Moving = best sellers over the last 7 days, Recent = what this cashier sold last.
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: sold } = await supabase.from("order_items")
    .select("variant_id, quantity, order:orders!inner(created_at, created_by, status)")
    .gte("order.created_at", since).neq("order.status", "cancelled").not("variant_id", "is", null)
    .order("created_at", { referencedTable: "order", ascending: false }).limit(3000);
  const week = Date.now() - 7 * 86400000;
  const tally = (rows: typeof sold) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.variant_id!, (m.get(r.variant_id!) ?? 0) + r.quantity);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 12);
  };
  const order = (r: NonNullable<typeof sold>[number]) => r.order as unknown as { created_at: string; created_by: string | null };
  const activity = {
    quick: tally(sold),
    fast: tally((sold ?? []).filter((r) => new Date(order(r).created_at).getTime() >= week)),
    recent: [...new Set((sold ?? []).filter((r) => me && order(r).created_by === me.id)
      .sort((a, b) => order(b).created_at.localeCompare(order(a).created_at)).map((r) => r.variant_id!))].slice(0, 12),
  };
  const rateBy = new Map(((rates ?? []) as { variant_id: string; tax_type: TaxType; tax_rate: number }[]).map((r) => [r.variant_id, r]));
  const stock = await getStock(products.flatMap((p) => p.variants.map((v) => v.id)));
  const wholesaleBy = new Map((wholesale ?? []).map((w) => [w.profile_id, w.business_name]));

  const items: PosItem[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      sku: v.sku,
      name: p.name,
      variantName: v.name ?? v.size ?? v.shade ?? v.hair_length ?? v.color ?? null,
      brand: p.brand ?? null,
      color: v.color, shade: v.shade, size: v.size, length: v.hair_length,
      image: p.image,
      category: p.category.slug,
      group: p.category.parentSlug ?? p.category.slug,
      retail: v.price,
      available: stock[v.id]?.available ?? 0,
      low: stock[v.id]?.low ?? false,
      taxType: rateBy.get(v.id)?.tax_type ?? "B",
      taxRate: Number(rateBy.get(v.id)?.tax_rate ?? 0),
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
      threshold={tier?.min_order_quantity ?? 10} recentSales={recentSales} store={store} cashier={cashier} activity={activity} />
  );
}
