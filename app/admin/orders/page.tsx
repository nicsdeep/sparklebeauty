import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, PaymentBadge, StatusBadge, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, kes } from "@/lib/format";

export const metadata = { title: "Orders" };

const TABS = [
  { id: "all", label: "All", statuses: null },
  { id: "new", label: "New", statuses: ["pending"] },
  { id: "progress", label: "In progress", statuses: ["confirmed", "paid", "processing", "packed", "dispatched", "delivered"] },
  { id: "completed", label: "Completed", statuses: ["completed"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded"] },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; channel?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const supabase = await createClient();
  let query = supabase.from("orders")
    .select("id, order_number, customer_name, customer_phone, channel, status, payment_status, total_amount, created_at, tier:pricing_tiers(code), order_items(quantity)")
    .order("created_at", { ascending: false }).limit(200);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (sp.channel === "online" || sp.channel === "pos") query = query.eq("channel", sp.channel);
  if (sp.q) query = query.or(`order_number.ilike.%${sp.q.replace(/[%,()]/g, "")}%,customer_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const { data: orders } = await query;

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Online orders and in-store sales in one list." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.id} href={link({ tab: t.id === "all" ? undefined : t.id })}
            className={cx("rounded-full px-4 py-2 text-sm font-semibold", t.id === tab.id ? "bg-brand-600 text-white" : "border border-line bg-white hover:bg-surface")}>{t.label}</Link>
        ))}
        <span className="mx-2 h-6 w-px bg-line" />
        {[["", "All channels"], ["online", "Online"], ["pos", "POS"]].map(([c, label]) => (
          <Link key={c} href={link({ channel: c || undefined })}
            className={cx("rounded-full px-4 py-2 text-sm font-semibold", (sp.channel ?? "") === c ? "bg-ink text-white" : "border border-line bg-white hover:bg-surface")}>{label}</Link>
        ))}
        <form className="ml-auto" action="/admin/orders">
          {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
          <input name="q" defaultValue={sp.q} placeholder="Search order or customer" className="h-10 w-64 rounded-full border border-line bg-white px-4" aria-label="Search orders" />
        </form>
      </div>
      <Card>
        {orders?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Order</th><th className="px-3 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Channel</th>
                <th className="px-3 py-3 font-medium">Items</th><th className="px-3 py-3 font-medium">Payment</th><th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={cx("border-b border-line last:border-0 hover:bg-surface", o.status === "pending" && "bg-amber-bg/40")}>
                    <td className="px-5 py-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link>
                      <span className="block text-xs text-ink-muted">{formatDateTime(o.created_at)}</span></td>
                    <td className="px-3 py-3">{o.customer_name}<span className="block text-sm text-ink-muted">{o.customer_phone}</span></td>
                    <td className="px-3 py-3"><div className="flex gap-1">
                      <Badge tone={o.channel === "pos" ? "neutral" : "brand"}>{o.channel === "pos" ? "POS" : "Online"}</Badge>
                      {(o.tier as unknown as { code: string } | null)?.code === "wholesale" && <Badge tone="info">Wholesale</Badge>}</div></td>
                    <td className="px-3 py-3">{o.order_items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)}</td>
                    <td className="px-3 py-3"><PaymentBadge status={o.payment_status} /></td>
                    <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-right font-semibold">{kes(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState title="No orders match" /></div>}
      </Card>
    </div>
  );
}
