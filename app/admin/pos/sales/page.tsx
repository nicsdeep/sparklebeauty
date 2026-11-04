import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/admin/back-link";
import { FilterInput, FilterSelect, Pagination } from "@/components/admin/list-controls";
import { LiveSearch } from "@/components/live-search";
import { Badge, Card, PaymentBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { channelMeta, formatDateTimeFull, kes, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import { pageParams } from "@/lib/pagination";

export const metadata: Metadata = { title: "Recent Sales" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

/**
 * Completed till sales (rung up by staff; online orders are on the Orders page), newest first.
 * Search, filters and pages are database queries, 10–50 rows at a time.
 */
export default async function RecentSalesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { page, size, from, to } = pageParams(sp);
  const q = one(sp.q), method = one(sp.method), customer = one(sp.customer), channel = one(sp.channel);
  const dateFrom = one(sp.from), dateTo = one(sp.to), min = Number(one(sp.min)) || 0, max = Number(one(sp.max)) || 0;
  const supabase = await createClient();

  // A payment reference typed in the search box finds its sale.
  let refOrders: string[] = [];
  if (q) {
    const { data } = await supabase.from("payments").select("order_id").ilike("provider_reference", `%${q}%`).limit(50);
    refOrders = (data ?? []).map((p) => p.order_id);
  }

  // A method filter needs an inner join on payments (only sales paid that way).
  const columns: string = `id, order_number, created_at, customer_id, customer_name, channel, total_amount, payment_status, status,
      order_items(quantity), payments${method ? "!inner" : ""}(method, status)`;
  let query = supabase.from("orders").select(columns, { count: "exact" })
    .not("created_by", "is", null).neq("channel", "online");
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    query = query.or([`order_number.ilike.${like}`, `customer_name.ilike.${like}`, ...(refOrders.length ? [`id.in.(${refOrders.join(",")})`] : [])].join(","));
  }
  if (method) query = query.eq("payments.method", method);
  if (customer === "walk-in") query = query.is("customer_id", null);
  if (customer === "registered") query = query.filter("customer_id", "not.is", null);
  if (channel) query = query.eq("channel", channel);
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00+03:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999+03:00`);
  if (min) query = query.gte("total_amount", min);
  if (max) query = query.lte("total_amount", max);
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const sales = (data ?? []) as unknown as {
    id: string; order_number: string; created_at: string; customer_name: string | null; channel: string; total_amount: number; payment_status: string;
    order_items: { quantity: number }[]; payments: { method: PaymentMethod; status: string }[];
  }[];
  const backQuery = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));

  return (
    <div className="space-y-5">
      <div>
        <BackLink fallback="/admin/pos" label="POS" />
        <h1 className="mt-2 text-2xl font-bold">Recent Sales</h1>
        <p className="text-ink-muted">View and manage completed POS transactions.</p>
      </div>

      <Card className="space-y-3 p-4">
        <LiveSearch placeholder="Search order, customer, payment reference…" className="max-w-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <FilterInput label="From" param="from" type="date" />
          <FilterInput label="To" param="to" type="date" />
          <FilterSelect label="Payment method" param="method" options={[["", "All methods"], ...(["mpesa", "cash", "card", "bank_transfer"] as const).map((m) => [m, PAYMENT_LABEL[m]] as [string, string])]} />
          <FilterSelect label="Customer" param="customer" options={[["", "All customers"], ["walk-in", "Walk-in"], ["registered", "Registered"]]} />
          <FilterSelect label="Sale channel" param="channel" options={[["", "All channels"], ["pos", "In store"], ["wholesale", "Wholesale"]]} />
          <FilterInput label="Min amount (KES)" param="min" type="number" placeholder="0" />
          <FilterInput label="Max amount (KES)" param="max" type="number" placeholder="Any" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-surface text-sm text-ink-muted"><tr>
              {["Order", "Date & time", "Customer", "Items", "Payment", "Total", "Status", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 font-medium ${h === "Total" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sales.map((s) => {
                const methods = [...new Set(s.payments.filter((p) => p.status !== "failed").map((p) => PAYMENT_LABEL[p.method] ?? p.method))];
                const units = s.order_items.reduce((n, i) => n + i.quantity, 0);
                const href = `/admin/pos/sales/${s.order_number}`;
                return (
                  <tr key={s.id} className="border-t border-line hover:bg-surface/60">
                    <td className="px-4 py-3"><Link href={href} className="font-semibold text-brand-700">{s.order_number}</Link>
                      {s.channel !== "pos" && <Badge tone={channelMeta(s.channel).tone} className="ml-2">{channelMeta(s.channel).label}</Badge>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{formatDateTimeFull(s.created_at)}</td>
                    <td className="px-4 py-3">{s.customer_name ?? "Walk-in customer"}</td>
                    <td className="px-4 py-3 text-sm">{units} item{units === 1 ? "" : "s"}</td>
                    <td className="px-4 py-3 text-sm">{methods.join(" + ") || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{kes(s.total_amount)}</td>
                    <td className="px-4 py-3"><PaymentBadge status={s.payment_status} /></td>
                    <td className="px-4 py-3 text-right"><Link href={href} className="font-semibold text-brand-700">View</Link></td>
                  </tr>
                );
              })}
              {!sales.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-muted">{backQuery.size ? "No sales match these filters." : "No till sales yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3"><Pagination page={page} size={size} total={count ?? 0} noun="sales" /></div>
      </Card>
    </div>
  );
}
