import Link from "next/link";
import { AiCard, Badge, Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui";
import { BarChart, SplitBar, Stat } from "@/components/admin/charts";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, kes, startOfTodayNairobi } from "@/lib/format";
import { dayKey, loadSales, loadStock, stockState, fullName } from "@/lib/sales-data";
import { customerInsights, stockInsights, stockSentence } from "@/lib/insights";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [sales, stock, { data: recent }, { count: customers }, { count: newCustomers }] = await Promise.all([
    loadSales(30),
    loadStock(),
    supabase.from("orders").select("id, order_number, customer_name, channel, status, total_amount, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
  ]);

  const today = startOfTodayNairobi();
  const todays = sales.filter((s) => s.created_at >= today);
  const open = sales.filter((s) => ["pending", "confirmed", "paid", "processing", "packed"].includes(s.status));
  const lowStock = stock.filter((r) => stockState(r) !== "ok").sort((a, b) => a.available / Math.max(1, a.reorder_level) - b.available / Math.max(1, b.reorder_level));

  const days = [...Array(14)].map((_, i) => dayKey(new Date(Date.now() - (13 - i) * 86400000).toISOString()));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const s of sales) if (byDay.has(dayKey(s.created_at))) byDay.set(dayKey(s.created_at), byDay.get(dayKey(s.created_at))! + s.total);
  const trend = days.map((d, i) => ({ label: new Date(`${d}T12:00:00+03:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }), value: byDay.get(d)!, highlight: i === 13 }));

  const sum = (xs: typeof sales) => xs.reduce((t, s) => t + s.total, 0);
  const best = new Map<string, { qty: number; revenue: number }>();
  for (const s of sales) for (const l of s.lines) {
    const b = best.get(l.product_name.split(" – ")[0]) ?? { qty: 0, revenue: 0 };
    b.qty += l.quantity; b.revenue += l.line_total;
    best.set(l.product_name.split(" – ")[0], b);
  }
  const bestSellers = [...best.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const ai = [...stockInsights(sales, stock).slice(0, 2).map((i) => ({ title: "Stock", text: stockSentence(i) })),
    ...customerInsights(sales).slice(0, 1).map((c) => ({ title: "Customer", text: c.sentence }))];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Today at Sparkle Beauty & Cosmetics, online and in store." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's sales" value={kes(sum(todays))} note={`${todays.length} order${todays.length === 1 ? "" : "s"} today`} />
        <Stat label="Orders to process" value={String(open.length)} note={`${sales.filter((s) => s.status === "pending").length} new`} />
        <Stat label="Customers" value={String(customers ?? 0)} note={`${newCustomers ?? 0} joined in the last 90 days`} />
        <Stat label="Low-stock items" value={String(lowStock.length)} note="At or below reorder level" tone={lowStock.length ? "amber" : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Sales trend" subtitle={`Last 14 days · ${kes(sum(sales.filter((s) => s.created_at >= new Date(Date.now() - 14 * 86400000).toISOString())))}`} action={<Link href="/admin/reports" className="text-sm font-semibold text-brand-700">Reports</Link>} />
          <div className="p-5 pt-10"><BarChart data={trend} /></div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Online vs in-store" subtitle="Last 30 days" />
            <div className="p-5"><SplitBar a={{ label: "Online", value: sum(sales.filter((s) => s.channel === "online")) }} b={{ label: "POS (shop)", value: sum(sales.filter((s) => s.channel === "pos")) }} /></div>
          </Card>
          <Card>
            <CardHeader title="Retail vs wholesale" subtitle="Last 30 days" />
            <div className="p-5"><SplitBar a={{ label: "Retail", value: sum(sales.filter((s) => s.tier === "retail")) }} b={{ label: "Wholesale", value: sum(sales.filter((s) => s.tier === "wholesale")) }} /></div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Recent orders" action={<Link href="/admin/orders" className="text-sm font-semibold text-brand-700">All orders</Link>} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Order</th><th className="px-3 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Channel</th>
                <th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Total</th></tr></thead>
              <tbody>
                {(recent ?? []).map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-5 py-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link>
                      <span className="block text-xs text-ink-muted">{formatDateTime(o.created_at)}</span></td>
                    <td className="px-3 py-3">{o.customer_name}</td>
                    <td className="px-3 py-3"><Badge tone={o.channel === "pos" ? "neutral" : "brand"}>{o.channel === "pos" ? "POS" : "Online"}</Badge></td>
                    <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-right font-semibold">{kes(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Best sellers" subtitle="Last 30 days" />
            <ol className="divide-y divide-line">
              {bestSellers.map(([name, b], i) => (
                <li key={name} className="flex items-center gap-3 px-5 py-3 text-[15px]">
                  <span className="w-5 font-bold text-ink-muted">{i + 1}</span>
                  <span className="flex-1">{name}<span className="block text-xs text-ink-muted">{b.qty} sold</span></span>
                  <span className="font-semibold">{kes(b.revenue)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Stock alerts" action={<Link href="/admin/inventory?filter=low" className="text-sm font-semibold text-brand-700">Inventory</Link>} />
            <ul className="divide-y divide-line">
              {lowStock.slice(0, 6).map((r) => (
                <li key={r.variant_id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[15px]">
                  <span>{fullName(r)}</span>
                  <Badge tone={r.available <= 0 ? "rose" : "amber"}>{r.available <= 0 ? "Out" : `${r.available} left`}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ai.map((a, i) => <AiCard key={i} title={a.title}>{a.text}</AiCard>)}
      </div>
      <p className="text-right"><Link href="/admin/insights" className="font-semibold text-ai-fg">See all AI insights →</Link></p>
    </div>
  );
}
