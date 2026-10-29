import { listProducts, getStock } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { PosTerminal, type PosCustomer, type PosItem } from "./terminal";

export const metadata = { title: "POS" };

export default async function PosPage() {
  const supabase = await createClient();
  const [products, { data: customers }, { data: wholesale }, { data: tier }] = await Promise.all([
    listProducts(),
    supabase.from("profiles").select("id, full_name, phone, email, loyalty_points").eq("role", "customer").order("full_name"),
    supabase.from("wholesale_accounts").select("profile_id, business_name"),
    supabase.from("pricing_tiers").select("min_order_quantity").eq("code", "wholesale").single(),
  ]);
  const store = await getStoreSettings();
  const stock = await getStock(products.flatMap((p) => p.variants.map((v) => v.id)));
  const wholesaleBy = new Map((wholesale ?? []).map((w) => [w.profile_id, w.business_name]));

  const items: PosItem[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      name: p.name,
      variantName: p.variants.length > 1 ? (v.name ?? null) : null,
      category: p.category.slug,
      group: p.category.parentSlug ?? p.category.slug,
      retail: v.price,
      wholesale: v.wholesale_price ?? v.price,
      available: stock[v.id]?.available ?? 0,
      low: stock[v.id]?.low ?? false,
    })),
  );
  const posCustomers: PosCustomer[] = (customers ?? []).map((c) => ({
    id: c.id, name: c.full_name ?? "", phone: c.phone ?? "", email: c.email ?? "", points: c.loyalty_points,
    business: wholesaleBy.get(c.id) ?? null,
  }));

  return <PosTerminal items={items} customers={posCustomers} wholesaleMin={tier?.min_order_quantity ?? 6} store={store} />;
}
