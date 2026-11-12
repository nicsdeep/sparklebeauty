import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/admin/back-link";
import { Badge, Card, CardHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatDateTimeFull, kes } from "@/lib/format";
import { Countdown, SuspensionActions } from "../../suspension-actions";
import { SUSPENSION_STATUS, suspensionTotal, type SuspensionRow } from "../../suspension-data";

type Params = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: decodeURIComponent((await params).reference) };
}

const EVENT_LABEL: Record<string, string> = { suspended: "Suspended", extended: "Extended", completed: "Paid", released: "Released", expired: "Expired" };

/** One suspended sale: its cart, hold, history and (once paid) the sale it became. */
export default async function SuspensionPage({ params }: Params) {
  const reference = decodeURIComponent((await params).reference);
  const supabase = await createClient();
  await supabase.rpc("expire_pos_suspensions");
  const [{ data }, { data: rateRows }] = await Promise.all([
    supabase.from("pos_suspensions")
      .select(`id, reference, customer_id, customer_name, customer_phone, discount_pct, notes, status, expires_at, created_at, closed_at,
        by:profiles!pos_suspensions_created_by_fkey(full_name), order:orders(order_number),
        pos_suspension_items(variant_id, name, quantity, unit_price),
        pos_suspension_events(action, expires_at, created_at, by:profiles(full_name))`)
      .eq("reference", reference).maybeSingle(),
    fetchAll((from, to) => supabase.rpc("variant_tax_rates").order("variant_id").range(from, to)),
  ]);
  if (!data) notFound();
  const s = data as unknown as Omit<SuspensionRow, "pos_suspension_items"> & {
    customer_id: string | null; notes: string | null; by: { full_name: string | null } | null; order: { order_number: string } | null;
    pos_suspension_items: { variant_id: string; name: string; quantity: number; unit_price: number }[];
    pos_suspension_events: { action: string; expires_at: string | null; created_at: string; by: { full_name: string | null } | null }[];
  };
  const rates = new Map(((rateRows ?? []) as { variant_id: string; tax_rate: number }[]).map((r) => [r.variant_id, Number(r.tax_rate)]));
  const meta = SUSPENSION_STATUS[s.status];
  const events = [...s.pos_suspension_events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sub = s.pos_suspension_items.reduce((n, i) => n + Number(i.unit_price) * i.quantity, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink fallback="/admin/pos/suspended" label="Suspended Sales" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{s.reference}</h1>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {s.status === "active" && <Countdown expiresAt={s.expires_at} />}
          </div>
          <p className="text-ink-muted">Suspended {formatDateTimeFull(s.created_at)}{s.by?.full_name ? ` by ${s.by.full_name}` : ""} · {s.status === "active" ? `expires ${formatDateTimeFull(s.expires_at)}` : s.closed_at ? `ended ${formatDateTimeFull(s.closed_at)}` : ""}</p>
        </div>
        {s.status === "active" && <SuspensionActions id={s.id} reference={s.reference} expiresAt={s.expires_at} />}
        {s.order && <Link href={`/admin/pos/sales/${s.order.order_number}`} className="font-semibold text-brand-700">View sale {s.order.order_number} ›</Link>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Items held" subtitle={s.status === "active" ? "These units are off sale on the website and every till until paid, released or expired." : "No longer held."} />
          <ul className="divide-y divide-line">
            {s.pos_suspension_items.map((i) => (
              <li key={i.variant_id} className="flex justify-between gap-3 px-5 py-3 text-[15px]">
                <span>{i.quantity} × {i.name}<span className="block text-sm text-ink-muted">{kes(i.unit_price)} each when suspended</span></span>
                <span className="font-semibold tabular-nums">{kes(Number(i.unit_price) * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[15px]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{kes(sub)}</dd></div>
            {Number(s.discount_pct) > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount ({Number(s.discount_pct)}%)</dt><dd className="tabular-nums">-{kes(Math.round((sub * Number(s.discount_pct)) / 100))}</dd></div>}
            <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total (VAT incl.)</dt><dd className="tabular-nums">{kes(suspensionTotal(s, rates))}</dd></div>
          </dl>
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">The sale is re-priced by the pricing engine when it&apos;s paid.</p>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <div className="p-5 text-[15px]">
              <p className="font-semibold">{s.customer_name ?? "Walk-in customer"}</p>
              {s.customer_phone && <p className="text-ink-muted">{s.customer_phone}</p>}
              {s.customer_id && <Link href={`/admin/customers/${s.customer_id}`} className="mt-2 inline-block text-sm font-semibold text-brand-700">Customer profile ›</Link>}
              {s.notes && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">“{s.notes}”</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="space-y-3 p-5 text-[15px]">
              {events.map((e, i) => (
                <li key={i}>
                  <p className="font-semibold">{EVENT_LABEL[e.action] ?? e.action}{e.action === "extended" && e.expires_at ? ` to ${formatDateTimeFull(e.expires_at)}` : ""}</p>
                  <p className="text-sm text-ink-muted">{formatDateTimeFull(e.created_at)}{e.by?.full_name ? ` · ${e.by.full_name}` : e.action === "expired" ? " · automatically" : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
