import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { LiveSearch } from "@/components/live-search";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { formatDateTime, kes } from "@/lib/format";
import { ETIMS_META, INVOICE_SELECT, toInvoice } from "@/lib/invoices";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invoices" };

const TABS = [
  { key: "", label: "All" },
  { key: "waiting", label: "Waiting for eTIMS" },
  { key: "credit", label: "Credit notes" },
];

/** Tax invoices and credit notes, issued automatically when orders are paid or refunded. */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("invoices").select(INVOICE_SELECT).order("issued_at", { ascending: false }).limit(200);
  if (sp.tab === "waiting") query = query.neq("etims_status", "sent");
  if (sp.tab === "credit") query = query.eq("kind", "credit_note");
  const q = sp.q?.trim().replace(/[%,()*]/g, "");
  if (q) query = query.or(`invoice_number.ilike.%${q}%,buyer_name.ilike.%${q}%,buyer_kra_pin.ilike.%${q}%`);
  const [{ data }, { count: waiting }] = await Promise.all([
    query,
    supabase.from("invoices").select("id", { count: "exact", head: true }).neq("etims_status", "sent"),
  ]);
  const invoices = (data ?? []).map(toInvoice);
  const href = (tab: string) => `/admin/invoices${tab ? `?tab=${tab}` : ""}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="KRA tax invoices and credit notes. Issued automatically when an order is paid or refunded." />
      {(waiting ?? 0) > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-bg px-4 py-3 text-[15px] text-amber-fg" role="status">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <span>KRA eTIMS isn&apos;t connected yet, so {waiting} invoice{waiting === 1 ? " is" : "s are"} waiting to be sent. They are kept in order and will be
            sent once the eTIMS credentials from KRA are set up. Nothing has been reported to KRA from this system so far.</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", (sp.tab ?? "") === t.key ? "bg-brand-600 text-white" : "border border-line bg-white")}>{t.label}</Link>
        ))}
        <LiveSearch placeholder="Invoice no., customer or KRA PIN" className="ml-auto w-72 max-w-full" />
      </div>
      {invoices.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[15px]">
            <thead className="border-b border-line text-left text-sm text-ink-muted">
              <tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-5 py-3 font-semibold">Order</th><th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 text-right font-semibold">VAT</th><th className="px-5 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 font-semibold">KRA eTIMS</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface/60">
                  <td className="px-5 py-3"><Link href={`/admin/invoices/${inv.id}`} className="font-mono font-semibold text-brand-700">{inv.invoice_number}</Link>
                    {inv.kind === "credit_note" && <Badge tone="rose" className="ml-2">Credit note</Badge>}
                    <span className="block text-sm text-ink-muted">{formatDateTime(inv.issued_at)}</span></td>
                  <td className="px-5 py-3"><Link href={`/admin/orders/${inv.order_id}`} className="hover:text-brand-700">{inv.order?.order_number}</Link></td>
                  <td className="px-5 py-3">{inv.buyer_name ?? "Walk-in customer"}{inv.buyer_kra_pin && <span className="block font-mono text-sm text-ink-muted">{inv.buyer_kra_pin}</span>}</td>
                  <td className="px-5 py-3 text-right">{kes(inv.tax_amount)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{inv.kind === "credit_note" ? "-" : ""}{kes(inv.total_amount)}</td>
                  <td className="px-5 py-3"><Badge tone={ETIMS_META[inv.etims_status].tone}>{ETIMS_META[inv.etims_status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title={q ? "No matching invoices" : "No invoices yet"}>Invoices are issued automatically when an order is paid: a till sale, an online payment or cash on delivery.</EmptyState>
      )}
    </div>
  );
}
