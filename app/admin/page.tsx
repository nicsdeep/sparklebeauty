import Link from "next/link";
import {
  ArrowRight, BarChart3, Calendar, ClipboardList, Megaphone, MoreHorizontal, Package, PackagePlus, ShoppingBag, ShoppingCart,
  Store, TriangleAlert, Trophy, UserPlus, Users, Zap,
} from "lucide-react";
import { Badge, Card, StatusBadge, cx } from "@/components/ui";
import { BarChart, KpiCard, SplitBar } from "@/components/admin/charts";
import { ProductImage } from "@/components/shop/product-image";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL_META, formatDateTime, kes, startOfTodayNairobi, channelMeta } from "@/lib/format";
import { dayKey, loadSales, loadStock, stockState } from "@/lib/sales-data";

export const metadata = { title: "Dashboard" };

const initials = (name: string | null) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "WC";

function SectionTitle({ Icon, title, subtitle, action, tone = "text-brand-600" }: { Icon: typeof BarChart3; title: string; subtitle?: string; action?: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3">
        <Icon className={cx("mt-0.5 size-6 shrink-0", tone)} strokeWidth={1.8} />
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const ViewAll = ({ href, label = "View All" }: { href: string; label?: string }) => (
  <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600">{label} <ArrowRight className="size-4" /></Link>
);

export default async function DashboardPage() {
  const supabase = await createClient();
  const [sales, stock, { data: recent }, { count: customers }, { count: newCustomers }] = await Promise.all([
    loadSales(30),
    loadStock(),
    supabase.from("orders").select("id, order_number, customer_name, customer_id, channel, status, total_amount, created_at, order_items(quantity)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
  ]);

  const sum = (xs: typeof sales) => xs.reduce((t, s) => t + s.total, 0);
  const today = startOfTodayNairobi();
  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString();
  const todays = sales.filter((s) => s.created_at >= today);
  const yesterdays = sales.filter((s) => s.created_at >= yesterday && s.created_at < today);
  const change = sum(yesterdays) > 0 ? ((sum(todays) - sum(yesterdays)) / sum(yesterdays)) * 100 : null;
  const open = sales.filter((s) => ["pending", "confirmed", "paid", "processing", "packed"].includes(s.status));
  const pending = sales.filter((s) => s.status === "pending").length;
  const attention = stock.filter((r) => stockState(r) !== "ok")
    .sort((a, b) => a.available / Math.max(1, a.reorder_level) - b.available / Math.max(1, b.reorder_level));
  const outCount = attention.filter((r) => stockState(r) === "out").length;

  const days = [...Array(14)].map((_, i) => dayKey(new Date(Date.now() - (13 - i) * 86400000).toISOString()));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const s of sales) if (byDay.has(dayKey(s.created_at))) byDay.set(dayKey(s.created_at), byDay.get(dayKey(s.created_at))! + s.total);
  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00+03:00`).toLocaleDateString("en-KE", opts);
  const trend = days.map((d, i) => ({ label: dayLabel(d, { day: "numeric", month: "short" }), value: byDay.get(d)!, highlight: i === 13 }));
  const range = `${dayLabel(days[0], { month: "short", day: "numeric", year: "numeric" })} – ${dayLabel(days[13], { month: "short", day: "numeric", year: "numeric" })}`;

  // Best sellers by product over 30 days, with each product's photo.
  const best = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const s of sales) for (const l of s.lines) {
    const key = l.product_id ?? l.product_name;
    const b = best.get(key) ?? { name: l.product_name.split(" – ")[0], qty: 0, revenue: 0 };
    b.qty += l.quantity; b.revenue += l.line_total;
    best.set(key, b);
  }
  const bestSellers = [...best.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const lowCards = attention.slice(0, 5);
  const ids = [...new Set([...bestSellers.map(([id]) => id), ...lowCards.map((r) => r.product_id)])];
  const { data: photos } = await supabase.from("products").select("id, image_urls, category:categories(slug)").in("id", ids);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photo = new Map((photos ?? []).map((p: any) => [p.id, { image: p.image_urls?.[0] ?? null, category: p.category?.slug ?? "" }]));

  const actions = [
    { href: "/admin/pos", label: "Create Order", Icon: ShoppingCart, cls: "bg-brand-50 text-brand-700 hover:bg-brand-100" },
    { href: "/admin/customers/new", label: "New Customer", Icon: UserPlus, cls: "bg-teal-bg text-teal-fg hover:brightness-95" },
    { href: "/admin/products/new", label: "Add Product", Icon: PackagePlus, cls: "bg-info-bg text-info-fg hover:brightness-95" },
    { href: "/admin/promotions/new", label: "Create Promotion", Icon: Megaphone, cls: "bg-amber-bg text-amber-fg hover:brightness-95" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with the banner's "Glow · Slay · Sparkle" artwork fading in from the right. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden bg-gradient-to-r from-surface via-brand-50 to-[#fdcddb] px-4 pb-8 pt-8 lg:-mx-8 lg:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/admin-dashboard-art.jpg" alt="" aria-hidden width={1000} height={280}
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[52%] object-cover object-right xl:block"
          style={{ maskImage: "linear-gradient(to right, transparent, black 30%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 30%)" }} />
        <div className="relative">
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-ink-muted">Today at Sparkle Beauty &amp; Cosmetics, online and in-store.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's sales" value={kes(sum(todays))} Icon={ShoppingBag} tone="brand" trend={change}
          note={{ text: `${todays.length} order${todays.length === 1 ? "" : "s"} today` }} href="/admin/reports" />
        <KpiCard label="Orders to process" value={String(open.length)} Icon={ClipboardList} tone="info"
          note={pending ? { text: `${pending} new`, direction: "up", tone: "mint" } : { text: "No new orders" }} href="/admin/orders?tab=new" />
        <KpiCard label="Customers" value={String(customers ?? 0)} Icon={Users} tone="teal"
          note={{ text: `${newCustomers ?? 0} joined in the last 90 days`, direction: newCustomers ? "up" : undefined, tone: newCustomers ? "mint" : "muted" }} href="/admin/customers" />
        <KpiCard label="Low-stock items" value={String(attention.length)} Icon={Package} tone="amber"
          note={outCount ? { text: `${outCount} out of stock`, direction: "down", tone: "rose" } : { text: "At or below reorder level" }} href="/admin/inventory?filter=low" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle Icon={BarChart3} title="Sales trend" subtitle={`Last 14 days · ${kes(trend.reduce((t, d) => t + d.value, 0))}`}
              action={
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/reports" className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-brand-700 hover:border-brand-200">
                    Reports <ArrowRight className="size-4" /></Link>
                  <span className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm"><Calendar className="size-4 text-ink-muted" /> {range}</span>
                </div>
              } />
            <div className="p-5 pt-12"><BarChart data={trend} /></div>
          </Card>

          <Card>
            <SectionTitle Icon={ClipboardList} title="Recent orders" action={<Link href="/admin/orders" className="flex items-center gap-1.5 rounded-xl border border-brand-200 px-3.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">All orders <ArrowRight className="size-4" /></Link>} />
            <div className="relative mt-4 overflow-x-auto">
              <table className="w-full min-w-[660px] text-left text-[15px]">
                <thead className="bg-surface text-sm text-ink-muted"><tr>
                  <th className="px-4 py-3 font-medium">Order</th><th className="px-2.5 py-3 font-medium">Customer</th><th className="px-2.5 py-3 font-medium">Channel</th>
                  <th className="px-2.5 py-3 font-medium">Status</th><th className="px-2.5 py-3 text-center font-medium">Items</th>
                  <th className="px-2.5 py-3 text-right font-medium">Total</th><th className="px-2.5 py-3 font-medium">Date</th><th className="w-10 px-1 py-3"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {(recent ?? []).map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                      <td className="whitespace-nowrap px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-bold text-brand-700">{o.order_number}</Link></td>
                      <td className="px-2.5 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className={cx("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", o.customer_id ? "bg-brand-100 text-brand-700" : "bg-surface text-ink-muted")}>
                            {o.customer_id ? initials(o.customer_name) : "WC"}</span>
                          <span className="max-w-[7rem] truncate" title={o.customer_name ?? undefined}>{o.customer_name || "Walk-in customer"}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-3"><Badge tone={channelMeta(o.channel).tone}>{channelMeta(o.channel).label}</Badge></td>
                      <td className="px-2.5 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-2.5 py-3 text-center">{(o.order_items ?? []).reduce((t: number, i: { quantity: number }) => t + i.quantity, 0)}</td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-right font-bold">{kes(o.total_amount)}</td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-sm text-ink-muted">{formatDateTime(o.created_at)}</td>
                      <td className="px-1 py-3"><Link href={`/admin/orders/${o.id}`} aria-label={`Open ${o.order_number}`} className="grid size-8 place-items-center rounded-full hover:bg-surface"><MoreHorizontal className="size-5" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle Icon={TriangleAlert} title="Low-stock items" tone="text-rose-fg" action={<ViewAll href="/admin/inventory?filter=low" />} />
            {lowCards.length ? (
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {lowCards.map((r) => {
                  const p = photo.get(r.product_id);
                  return (
                    <Link key={r.variant_id} href="/admin/inventory?filter=low" className="flex flex-col gap-2 rounded-2xl border border-line p-3 transition hover:border-brand-200">
                      <ProductImage category={p?.category ?? r.category} name={r.product_name} image={p?.image} size="sm" className="rounded-xl" />
                      <span className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-snug">{r.variant_name ? `${r.product_name} (${r.variant_name})` : r.product_name}</span>
                      <span className={cx("self-start rounded-full px-2.5 py-1 text-xs font-bold text-white", r.available <= 0 ? "bg-rose-fg" : "bg-brand-600")}>
                        {r.available <= 0 ? "Out of stock" : `${r.available} left`}</span>
                    </Link>
                  );
                })}
              </div>
            ) : <p className="p-5 text-ink-muted">Everything is above its reorder level.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle Icon={Store} title="Sales by channel" subtitle="Last 30 days" />
            <div className="p-5"><SplitBar parts={(["online", "pos", "wholesale"] as const).map((c) => ({ label: CHANNEL_META[c].label, value: sum(sales.filter((s) => s.channel === c)) }))} /></div>
          </Card>
          <Card>
            <SectionTitle Icon={ShoppingCart} title="Retail vs wholesale" subtitle="Last 30 days" />
            <div className="p-5"><SplitBar parts={[{ label: "Retail", value: sum(sales.filter((s) => s.tier === "retail")) }, { label: "Wholesale", value: sum(sales.filter((s) => s.tier === "wholesale")) }]} /></div>
          </Card>
          <Card>
            <SectionTitle Icon={Trophy} title="Best sellers" subtitle="Last 30 days" tone="text-amber-fg" action={<ViewAll href="/admin/reports" />} />
            <ol className="space-y-1 p-3">
              {bestSellers.map(([id, b], i) => {
                const p = photo.get(id);
                return (
                  <li key={id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[15px]">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
                    <span className="size-11 shrink-0"><ProductImage category={p?.category ?? ""} name={b.name} image={p?.image} size="sm" className="rounded-lg" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.name}</span><span className="text-xs text-ink-muted">{b.qty} sold</span></span>
                    <span className="whitespace-nowrap font-bold">{kes(b.revenue)}</span>
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card>
            <SectionTitle Icon={Zap} title="Quick actions" />
            <div className="grid grid-cols-2 gap-3 p-5">
              {actions.map(({ href, label, Icon, cls }) => (
                <Link key={href} href={href} className={cx("flex items-center gap-2.5 rounded-xl px-3.5 py-3.5 text-sm font-semibold transition", cls)}>
                  <Icon className="size-5 shrink-0" /> {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
