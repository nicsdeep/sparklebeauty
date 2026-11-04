import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/admin/back-link";
import { Pagination } from "@/components/admin/list-controls";
import { LiveSearch } from "@/components/live-search";
import { Badge, Card, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeFull, kes } from "@/lib/format";
import { pageParams } from "@/lib/pagination";
import { Countdown, SuspensionActions } from "../suspension-actions";
import { SUSPENSION_STATUS, suspensionTotal, type SuspensionRow } from "../suspension-data";

export const metadata: Metadata = { title: "Suspended Sales" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

/** Suspended sales held in the database: active ones (soonest to expire first), or the history. */
export default async function SuspendedSalesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { page, size, from, to } = pageParams(sp);
  const tab = one(sp.tab) === "history" ? "history" : "active";
  const q = one(sp.q);
  const supabase = await createClient();
  await supabase.rpc("expire_pos_suspensions"); // in case the every-minute job hasn't run yet

  let query = supabase.from("pos_suspensions")
    .select("id, reference, customer_name, customer_phone, discount_pct, status, expires_at, created_at, closed_at, pos_suspension_items(variant_id, quantity, unit_price)", { count: "exact" });
  query = tab === "active" ? query.eq("status", "active") : query.neq("status", "active");
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    query = query.or(`reference.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`);
  }
  query = tab === "active" ? query.order("expires_at") : query.order("closed_at", { ascending: false });
  const [{ data, count }, { count: activeCount }, { data: rateRows }] = await Promise.all([
    query.range(from, to),
    supabase.from("pos_suspensions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.rpc("variant_tax_rates"),
  ]);
  const rows = (data ?? []) as unknown as SuspensionRow[];
  const rates = new Map(((rateRows ?? []) as { variant_id: string; tax_rate: number }[]).map((r) => [r.variant_id, Number(r.tax_rate)]));
  const tabLink = (t: string) => `/admin/pos/suspended${t === "history" ? "?tab=history" : ""}`;

  return (
    <div className="space-y-5">
      <div>
        <BackLink fallback="/admin/pos" label="POS" />
        <h1 className="mt-2 text-2xl font-bold">Suspended Sales</h1>
        <p className="text-ink-muted">Sales put aside with their stock held. Unpaid ones are released automatically when their time runs out.</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav className="flex gap-1 border-b border-line" aria-label="Suspended sales">
          {[["active", `Active (${activeCount ?? 0})`], ["history", "History"]].map(([t, label]) => (
            <Link key={t} href={tabLink(t)} aria-current={tab === t ? "page" : undefined}
              className={cx("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold", tab === t ? "border-brand-600 text-ink" : "border-transparent text-ink-muted hover:text-ink")}>{label}</Link>
          ))}
        </nav>
        <LiveSearch placeholder="Search reference, customer or phone…" className="w-full max-w-sm" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-surface text-sm text-ink-muted"><tr>
              {["Suspension", "Customer", "Items", "Total", "Suspended", tab === "active" ? "Expires" : "Ended", "Status", ""].map((h, i) => (
                <th key={i} className={cx("px-4 py-3 font-medium", h === "Total" && "text-right")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((s) => {
                const units = s.pos_suspension_items.reduce((n, i) => n + i.quantity, 0);
                const href = `/admin/pos/suspended/${s.reference}`;
                const meta = SUSPENSION_STATUS[s.status];
                return (
                  <tr key={s.id} className="border-t border-line align-top hover:bg-surface/60">
                    <td className="px-4 py-3"><Link href={href} className="font-semibold text-brand-700">{s.reference}</Link></td>
                    <td className="px-4 py-3"><span className="block">{s.customer_name ?? "Walk-in customer"}</span>
                      {s.customer_phone && <span className="text-sm text-ink-muted">{s.customer_phone}</span>}</td>
                    <td className="px-4 py-3 text-sm">{units} item{units === 1 ? "" : "s"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{kes(suspensionTotal(s, rates))}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{formatDateTimeFull(s.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {tab === "active" ? <><span className="block">{formatDateTimeFull(s.expires_at)}</span><Countdown expiresAt={s.expires_at} /></> : s.closed_at ? formatDateTimeFull(s.closed_at) : "-"}
                    </td>
                    <td className="px-4 py-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {s.status === "active" && <SuspensionActions id={s.id} reference={s.reference} expiresAt={s.expires_at} compact />}
                        <Link href={href} className="text-sm font-semibold text-brand-700">View</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                {q ? "No suspended sales match." : tab === "active" ? "No suspended sales. Use Suspend (F6) on the POS to put a sale aside." : "No past suspended sales yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3"><Pagination page={page} size={size} total={count ?? 0} noun="suspended sales" /></div>
      </Card>
    </div>
  );
}
