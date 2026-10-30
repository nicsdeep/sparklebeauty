import Link from "next/link";
import { Badge, Card, CardHeader, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { HBars, SplitBar, Stat } from "@/components/admin/charts";
import { loadSales } from "@/lib/sales-data";
import { formatDateTime, kes, startOfTodayNairobi, channelMeta } from "@/lib/format";

export const metadata = { title: "Retail" };

export default async function RetailPage() {
  const sales = (await loadSales(30)).filter((s) => s.tier === "retail");
  const today = sales.filter((s) => s.created_at >= startOfTodayNairobi());
  const sum = (xs: typeof sales) => xs.reduce((t, s) => t + s.total, 0);
  const walkIn = sales.filter((s) => s.channel === "pos" && !s.customer_id);
  const hours = new Map<number, number>();
  for (const s of sales.filter((x) => x.channel === "pos")) {
    const h = Number(new Date(s.created_at).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Nairobi" }));
    hours.set(h, (hours.get(h) ?? 0) + s.total);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Retail" subtitle="Individual customers at shelf prices, online and in the shop. Last 30 days."
        action={<Link href="/admin/pos" className={buttonClass()}>Open POS</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Retail sales today" value={kes(sum(today))} note={`${today.length} order${today.length === 1 ? "" : "s"}`} />
        <Stat label="Retail sales (30 days)" value={kes(sum(sales))} note={`${sales.length} orders`} />
        <Stat label="Average basket" value={kes(sales.length ? sum(sales) / sales.length : 0)} />
        <Stat label="Walk-in sales" value={String(walkIn.length)} note="POS sales without a customer profile" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Online vs in-store" /><div className="p-5"><SplitBar parts={[{ label: "Online", value: sum(sales.filter((s) => s.channel === "online")) }, { label: "In store", value: sum(sales.filter((s) => s.channel === "pos")) }]} /></div></Card>
        <Card><CardHeader title="Shop sales by hour" /><div className="p-5"><HBars rows={[...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ label: `${String(h).padStart(2, "0")}:00`, value: v }))} /></div></Card>
      </div>
      <Card>
        <CardHeader title="Recent retail orders" />
        <ul className="divide-y divide-line">
          {sales.slice(0, 15).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[15px]">
              <span><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link> · {o.customer_name} · {formatDateTime(o.created_at)}</span>
              <span className="flex items-center gap-2"><Badge tone={channelMeta(o.channel).tone}>{channelMeta(o.channel).label}</Badge><StatusBadge status={o.status} /><strong>{kes(o.total)}</strong></span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
