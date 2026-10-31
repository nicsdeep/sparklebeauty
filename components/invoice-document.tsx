import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META } from "@/lib/format";
import type { InvoiceBundle } from "@/lib/invoice-data";
import { ETIMS_META } from "@/lib/invoices";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { Badge, cx } from "@/components/ui";

/**
 * A KRA tax invoice or credit note as a branded document. The PDF (lib/invoice-pdf.tsx) follows
 * the same layout, so what staff and customers see on screen is what they download.
 */
export function InvoiceDocument({ bundle: { invoice: inv, payments, paymentStatus, store } }: { bundle: InvoiceBundle }) {
  const credit = inv.kind === "credit_note";
  const summary = (Object.entries(inv.tax_summary) as [TaxType, { rate: number; taxable: number; tax: number }][]).sort(([a], [b]) => a.localeCompare(b));
  const status = credit ? { label: "Credited", tone: "rose" as const } : PAYMENT_STATUS_META[paymentStatus] ?? { label: paymentStatus, tone: "neutral" as const };
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_12px_40px_-24px_rgba(31,26,29,0.35)]">
      <div className="h-2 bg-gradient-to-r from-brand-600 via-brand-500 to-logo-blue" />
      <div className="space-y-8 p-6 sm:p-10">
        {/* Seller and document */}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/sparkle-logo.svg" alt={inv.seller_name} width={1313} height={1116} className="h-20 w-auto" />
            <div className="space-y-0.5 text-sm text-ink-muted">
              <p className="text-base font-bold text-ink">{inv.seller_name}</p>
              <p>{store.address}</p>
              {store.landmark && <p>{store.landmark}</p>}
              <p>{[store.phones[0]?.number, store.email].filter(Boolean).join(" · ")}</p>
              <p className="pt-1 text-ink">KRA PIN <span className="font-semibold tracking-wide">{inv.seller_kra_pin ?? "Not set"}</span></p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{credit ? "Credit note" : "Tax invoice"}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{inv.invoice_number}</p>
            <div className="mt-2"><Badge tone={status.tone}>{status.label}</Badge></div>
          </div>
        </header>

        {/* Key facts */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-4">
          {[
            ["Issued", formatDateTimeFull(inv.issued_at)],
            ["Order", inv.order?.order_number ?? "—"],
            [credit ? "Credits invoice" : "Currency", credit ? inv.original?.invoice_number ?? "—" : "Kenya Shillings (KES)"],
            ["Amount", kes(inv.total_amount)],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface/60 px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
          ))}
        </dl>

        {/* Parties */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Billed to</p>
            <p className="mt-1 text-base font-bold">{inv.buyer_name ?? "Walk-in customer"}</p>
            {inv.buyer_phone && <p className="text-sm text-ink-muted">{inv.buyer_phone}</p>}
            <p className="mt-1 text-sm">KRA PIN <span className="font-semibold tracking-wide">{inv.buyer_kra_pin ?? "—"}</span></p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{credit ? "Refunded" : "Paid with"}</p>
            {payments.length ? (
              <ul className="mt-1 space-y-1 text-sm">
                {payments.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3"><span><span className="font-semibold">{PAYMENT_LABEL[p.method]}</span>
                    {p.provider_reference && <span className="ml-2 text-xs tracking-wide text-ink-muted">{p.provider_reference}</span>}</span><span>{kes(p.amount)}</span></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-ink-muted">—</p>}
          </div>
        </section>

        {/* Lines */}
        <section>
          <div className="hidden overflow-hidden rounded-2xl border border-line sm:block">
            <table className="w-full text-sm">
              <thead className="bg-brand-50 text-left text-xs font-bold uppercase tracking-wide text-brand-700">
                <tr><th className="px-4 py-3">Description</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Unit price</th>
                  <th className="px-3 py-3 text-right">Discount</th><th className="px-3 py-3">VAT</th><th className="px-3 py-3 text-right">VAT amount</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inv.lines.map((l, i) => (
                  <tr key={i} className={cx(i % 2 === 1 && "bg-surface/40")}>
                    <td className="px-4 py-3"><p className="font-semibold">{l.name}</p>{l.sku && <p className="text-xs tracking-wide text-ink-muted">{l.sku}</p>}</td>
                    <td className="px-3 py-3 text-right">{l.quantity}</td>
                    <td className="px-3 py-3 text-right">{kes(l.unit_price)}</td>
                    <td className="px-3 py-3 text-right">{l.discount ? `-${kes(l.discount)}` : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{l.tax_type} · {l.tax_rate}%</td>
                    <td className="px-3 py-3 text-right">{kes(l.tax)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{kes(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line sm:hidden">
            {inv.lines.map((l, i) => (
              <li key={i} className="p-4 text-sm">
                <div className="flex justify-between gap-3"><p className="font-semibold">{l.name}</p><p className="font-semibold">{kes(l.total)}</p></div>
                <p className="text-ink-muted">{l.quantity} × {kes(l.unit_price)}{l.discount ? ` · discount -${kes(l.discount)}` : ""} · VAT {l.tax_type} {l.tax_rate}% {kes(l.tax)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Tax summary and totals */}
        <section className="grid gap-6 sm:grid-cols-[1fr_minmax(0,320px)]">
          <div className="space-y-4">
            <table className="text-sm">
              <thead className="text-left text-xs font-bold uppercase tracking-wide text-ink-muted">
                <tr><th className="pb-2 pr-6">VAT summary</th><th className="pb-2 pr-6 text-right">Taxable</th><th className="pb-2 text-right">VAT</th></tr>
              </thead>
              <tbody>
                {summary.map(([t, s]) => (
                  <tr key={t}><td className="py-0.5 pr-6">{t} · {TAX_TYPES[t]}</td><td className="py-0.5 pr-6 text-right">{kes(s.taxable)}</td><td className="py-0.5 text-right">{kes(s.tax)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="rounded-2xl bg-surface p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold">KRA eTIMS <Badge tone={ETIMS_META[inv.etims_status].tone}>{ETIMS_META[inv.etims_status].label}</Badge></p>
              {inv.etims_status === "sent" ? (
                <p className="mt-1">CU invoice no. <strong>{inv.etims_receipt_number}</strong> · Signature {inv.etims_signature}</p>
              ) : (
                <p className="mt-1 text-ink-muted">{inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}Not yet transmitted to KRA. The control unit number, signature and QR code are added once eTIMS accepts it.</p>
              )}
            </div>
          </div>
          <dl className="h-fit space-y-2 rounded-2xl border border-line p-5 text-[15px]">
            <div className="flex justify-between"><dt className="text-ink-muted">Subtotal (excl. VAT)</dt><dd>{kes(inv.subtotal)}</dd></div>
            {inv.discount_amount > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd>-{kes(inv.discount_amount)}</dd></div>}
            {inv.delivery_amount > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Delivery</dt><dd>{kes(inv.delivery_amount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-muted">VAT</dt><dd>{kes(inv.tax_amount)}</dd></div>
            <div className="flex items-end justify-between border-t border-line pt-3"><dt className="font-bold">{credit ? "Total credited" : "Total"}</dt>
              <dd className="text-2xl font-extrabold text-brand-600">{kes(inv.total_amount)}</dd></div>
          </dl>
        </section>

        <footer className="border-t border-line pt-5 text-center text-sm text-ink-muted">
          <p className="font-semibold text-ink">Thank you for shopping with {inv.seller_name}!</p>
          <p className="mt-1">{store.hours} · {store.whatsapp ? `WhatsApp ${store.whatsapp}` : store.phones.map((p) => p.number).join(" · ")}</p>
        </footer>
      </div>
    </article>
  );
}
