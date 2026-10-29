import { createClient } from "@/lib/supabase/server";

export type CustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  marketing_consent: boolean;
  created_at: string;
  business: string | null;
  orders: number;
  spend: number;
  lastPurchase: string | null;
};

/** All customers with their order totals (cancelled orders excluded). */
export async function listCustomers(): Promise<CustomerRow[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: orders }, { data: wholesale }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, email, loyalty_points, marketing_consent, created_at").eq("role", "customer"),
    supabase.from("orders").select("customer_id, total_amount, created_at").neq("status", "cancelled").not("customer_id", "is", null),
    supabase.from("wholesale_accounts").select("profile_id, business_name"),
  ]);
  const biz = new Map((wholesale ?? []).map((w) => [w.profile_id, w.business_name]));
  const stats = new Map<string, { orders: number; spend: number; last: string }>();
  for (const o of orders ?? []) {
    const s = stats.get(o.customer_id!) ?? { orders: 0, spend: 0, last: "" };
    s.orders += 1;
    s.spend += Number(o.total_amount);
    if (o.created_at > s.last) s.last = o.created_at;
    stats.set(o.customer_id!, s);
  }
  return (profiles ?? []).map((p) => ({
    ...p,
    business: biz.get(p.id) ?? null,
    orders: stats.get(p.id)?.orders ?? 0,
    spend: stats.get(p.id)?.spend ?? 0,
    lastPurchase: stats.get(p.id)?.last || null,
  }));
}
