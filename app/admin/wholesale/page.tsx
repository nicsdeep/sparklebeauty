import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { Stat } from "@/components/admin/charts";
import { createClient } from "@/lib/supabase/server";
import { formatDate, kes } from "@/lib/format";

export const metadata = { title: "Wholesale" };

export default async function WholesalePage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: tier }, { data: orders }] = await Promise.all([
    supabase.from("wholesale_accounts").select("profile_id, business_name, business_location, created_at, profile:profiles(full_name, phone, email)"),
    supabase.from("pricing_tiers").select("id, min_order_quantity").eq("code", "wholesale").single(),
    supabase.from("orders").select("id, order_number, customer_id, customer_name, status, total_amount, created_at, tier:pricing_tiers!inner(code), order_items(quantity)")
      .eq("tier.code", "wholesale").order("created_at", { ascending: false }),
  ]);
  const byAccount = new Map<string, { orders: number; spend: number; last: string }>();
  for (const o of orders ?? []) {
    if (o.status === "cancelled" || !o.customer_id) continue;
    const s = byAccount.get(o.customer_id) ?? { orders: 0, spend: 0, last: "" };
    s.orders += 1; s.spend += Number(o.total_amount); if (o.created_at > s.last) s.last = o.created_at;
    byAccount.set(o.customer_id, s);
  }
  const revenue = [...byAccount.values()].reduce((s, a) => s + a.spend, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Wholesale" subtitle="Salons and resellers buying in bulk at wholesale prices."
        action={<Link href="/admin/pos" className={buttonClass()}>New Wholesale Sale</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Wholesale accounts" value={String(accounts?.length ?? 0)} />
        <Stat label="Wholesale revenue" value={kes(revenue)} note="All time" />
        <Stat label="Pricing rule" value={`Min ${tier?.min_order_quantity ?? 6} items`} note="About 25% below retail" />
      </div>
      <Card>
        <CardHeader title="Accounts" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Business</th><th className="px-3 py-3 font-medium">Contact</th><th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th><th className="px-3 py-3 text-right font-medium">Total spend</th><th className="px-5 py-3 font-medium">Last order</th></tr></thead>
            <tbody>
              {(accounts ?? []).map((a) => {
                const p = a.profile as unknown as { full_name: string; phone: string; email: string };
                const s = byAccount.get(a.profile_id);
                return (
                  <tr key={a.profile_id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><Link href={`/admin/customers/${a.profile_id}`} className="font-semibold text-brand-700">{a.business_name}</Link><span className="block text-sm text-ink-muted">{a.business_location}</span></td>
                    <td className="px-3 py-3">{p.full_name}<span className="block text-sm text-ink-muted">{p.email}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium">{p.phone}</td>
                    <td className="px-3 py-3 text-right">{s?.orders ?? 0}</td>
                    <td className="px-3 py-3 text-right font-semibold">{kes(s?.spend ?? 0)}</td>
                    <td className="px-5 py-3">{s?.last ? formatDate(s.last) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Wholesale orders" />
        <ul className="divide-y divide-line">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[15px]">
              <span><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link> · {o.customer_name} · {formatDate(o.created_at)}</span>
              <span className="flex items-center gap-2"><Badge tone="info">{o.order_items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)} items</Badge><StatusBadge status={o.status} /><strong>{kes(o.total_amount)}</strong></span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
