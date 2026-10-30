import Link from "next/link";
import { Card, CardHeader, PageHeader, cx } from "@/components/ui";
import { BarChart, HBars, SplitBar, Stat } from "@/components/admin/charts";
import { dayKey, GROUP_LABEL, loadSales } from "@/lib/sales-data";
import { CHANNEL_META, kes, PAYMENT_LABEL } from "@/lib/format";

export const metadata = { title: "Reports" };

const RANGES = [7, 30, 90];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const sales = await loadSales(days);
  const revenue = sales.reduce((s, o) => s + o.total, 0);
  const units = sales.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.quantity, 0), 0);

  const keys = [...Array(Math.min(days, 30))].map((_, i) => dayKey(new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 86400000).toISOString()));
  const byDay = new Map(keys.map((k) => [k, 0]));
  for (const s of sales) if (byDay.has(dayKey(s.created_at))) byDay.set(dayKey(s.created_at), byDay.get(dayKey(s.created_at))! + s.total);

  const tally = (key: (o: (typeof sales)[number]) => string) => {
    const m = new Map<string, number>();
    for (const s of sales) m.set(key(s), (m.get(key(s)) ?? 0) + s.total);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const groups = new Map<string, number>();
  const products = new Map<string, { qty: number; revenue: number }>();
  for (const s of sales) for (const l of s.lines) {
    groups.set(l.group, (groups.get(l.group) ?? 0) + l.line_total);
    const name = l.product_name.split(" – ")[0];
    const p = products.get(name) ?? { qty: 0, revenue: 0 };
    p.qty += l.quantity; p.revenue += l.line_total;
    products.set(name, p);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Sales across the website and the shop (cancelled orders excluded)."
        action={<div className="flex gap-2">{RANGES.map((r) => (
          <Link key={r} href={`/admin/reports?days=${r}`} className={cx("rounded-full px-4 py-2 text-sm font-semibold", r === days ? "bg-brand-600 text-white" : "border border-line bg-white")}>Last {r} days</Link>
        ))}</div>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={kes(revenue)} />
        <Stat label="Orders" value={String(sales.length)} />
        <Stat label="Average order" value={kes(sales.length ? revenue / sales.length : 0)} />
        <Stat label="Units sold" value={units.toLocaleString()} />
      </div>
      <Card>
        <CardHeader title="Revenue by day" subtitle={days > 30 ? "Last 30 days shown" : undefined} />
        <div className="p-5 pt-10"><BarChart data={keys.map((k, i) => ({ label: new Date(`${k}T12:00:00+03:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }), value: byDay.get(k)!, highlight: i === keys.length - 1 }))} /></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader title="By category" /><div className="p-5"><HBars rows={[...groups.entries()].sort((a, b) => b[1] - a[1]).map(([g, v]) => ({ label: GROUP_LABEL[g] ?? g, value: v }))} /></div></Card>
        <Card><CardHeader title="By payment method" /><div className="p-5"><HBars rows={tally((s) => s.payment_method ?? "other").map(([m, v]) => ({ label: PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m, value: v }))} /></div></Card>
        <div className="space-y-6">
          <Card><CardHeader title="Sales by channel" /><div className="p-5"><SplitBar parts={(["online", "pos", "wholesale"] as const).map((ch) => ({ label: CHANNEL_META[ch].label, value: tally((s) => s.channel).find(([c]) => c === ch)?.[1] ?? 0 }))} /></div></Card>
          <Card><CardHeader title="Retail vs wholesale" /><div className="p-5"><SplitBar parts={[{ label: "Retail", value: tally((s) => s.tier).find(([c]) => c === "retail")?.[1] ?? 0 }, { label: "Wholesale", value: tally((s) => s.tier).find(([c]) => c === "wholesale")?.[1] ?? 0 }]} /></div></Card>
        </div>
      </div>
      <Card>
        <CardHeader title="Top products" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-ink-muted"><tr className="border-b border-line"><th className="px-5 py-3 font-medium">#</th><th className="px-3 py-3 font-medium">Product</th><th className="px-3 py-3 text-right font-medium">Units</th><th className="px-5 py-3 text-right font-medium">Revenue</th></tr></thead>
            <tbody>
              {[...products.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([name, p], i) => (
                <tr key={name} className="border-b border-line last:border-0"><td className="px-5 py-2.5 text-ink-muted">{i + 1}</td><td className="px-3 py-2.5">{name}</td><td className="px-3 py-2.5 text-right">{p.qty}</td><td className="px-5 py-2.5 text-right font-semibold">{kes(p.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
