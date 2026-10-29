import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentMethod } from "@/lib/format";

export type SaleLine = {
  variant_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  line_total: number;
  category: string;
  group: string;
};

export type Sale = {
  id: string;
  order_number: string;
  status: OrderStatus;
  channel: "online" | "pos";
  payment_status: string;
  payment_method: PaymentMethod | null;
  tier: "retail" | "wholesale";
  total: number;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  lines: SaleLine[];
};

export type StockRow = {
  variant_id: string;
  sku: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  variant_name: string | null;
  category: string;
  quantity: number;
  reserved: number;
  available: number;
  reorder_level: number;
};

/** Orders (not cancelled) from the last `days` days, with their lines, for dashboards, reports and insights. */
export async function loadSales(days: number): Promise<Sale[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select(`id, order_number, status, channel, payment_status, total_amount, created_at, customer_id, customer_name,
      tier:pricing_tiers(code), payments(method),
      order_items(variant_id, product_id, product_name, quantity, line_total, product:products(category:categories(slug, parent:parent_id(slug))))`)
    .gte("created_at", since)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    channel: o.channel,
    payment_status: o.payment_status,
    payment_method: o.payments?.[0]?.method ?? null,
    tier: o.tier?.code === "wholesale" ? "wholesale" : "retail",
    total: Number(o.total_amount),
    created_at: o.created_at,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines: o.order_items.map((i: any) => ({
      variant_id: i.variant_id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      line_total: Number(i.line_total),
      category: i.product?.category?.slug ?? "other",
      group: i.product?.category?.parent?.slug ?? i.product?.category?.slug ?? "other",
    })),
  }));
}

export async function loadStock(): Promise<StockRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_levels")
    .select("quantity, reserved, reorder_level, variant:product_variants!inner(id, sku, name, is_active, product:products!inner(id, name, slug, category:categories(slug)))");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((l: any) => ({
    variant_id: l.variant.id,
    sku: l.variant.sku,
    product_id: l.variant.product.id,
    product_name: l.variant.product.name,
    product_slug: l.variant.product.slug,
    variant_name: l.variant.name,
    category: l.variant.product.category?.slug ?? "other",
    quantity: l.quantity,
    reserved: l.reserved,
    available: l.quantity - l.reserved,
    reorder_level: l.reorder_level,
  }));
}

export const stockState = (r: Pick<StockRow, "available" | "reorder_level">): "out" | "low" | "ok" =>
  r.available <= 0 ? "out" : r.available <= r.reorder_level ? "low" : "ok";

export const fullName = (r: Pick<StockRow, "product_name" | "variant_name">) =>
  r.variant_name ? `${r.product_name} (${r.variant_name})` : r.product_name;

export const GROUP_LABEL: Record<string, string> = {
  hair: "Hair",
  cosmetics: "Cosmetics",
  skincare: "Skincare",
  perfumes: "Perfumes",
  accessories: "Accessories",
};

/** Day key (YYYY-MM-DD) in Nairobi time. */
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
