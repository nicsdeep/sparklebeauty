import { DM_Serif_Display } from "next/font/google";
import { CheckCircle2, Info, QrCode } from "lucide-react";
import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META } from "@/lib/format";
import { ETIMS_META, vatHeading, type InvoiceBundle } from "@/lib/invoices";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { cx } from "@/components/ui";

// Nicholas's invoice template (2026-10-31). The PDF (lib/invoice-pdf.tsx) follows the same layout.
const serif = DM_Serif_Display({ weight: "400", style: ["normal", "italic"], subsets: ["latin"] });
const NAVY = "text-[#1c2150]";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted";

export function InvoiceDocument({ bundle: { invoice: inv, payments, paymentStatus, store } }: { bundle: InvoiceBundle }) {
  const credit = inv.kind === "credit_note";
  const summary = (Object.entries(inv.tax_summary) as [TaxType, { rate: number; taxable: number; tax: number }][]).sort(([a], [b]) => a.localeCompare(b));
  const vatTitle = vatHeading(inv.lines.map((l) => l.tax_rate));
  const status = credit ? { label: "Credited", tone: "rose" } : PAYMENT_STATUS_META[paymentStatus] ?? { label: paymentStatus, tone: "neutral" };
  const paid = status.tone === "teal" || status.tone === "mint";
  const etims = ETIMS_META[inv.etims_status];

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white text-[15px] shadow-[0_12px_40px_-24px_rgba(31,26,29,0.35)]">
      <div className="flex h-2"><div className="w-[53%] bg-brand-600" /><div className="flex-1 bg-logo-blue" /></div>
      <div className="space-y-7 p-6 sm:p-10">
        {/* Shop and document */}
        <header className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-start">
          <div className="flex flex-1 items-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/sparkle-logo.svg" alt="" width={1313} height={1116} className="h-16 w-auto shrink-0 sm:h-24" />
            <div className="space-y-0.5 text-ink-muted">
              <p className={cx(serif.className, NAVY, "text-2xl leading-tight sm:text-[28px]")}>{inv.seller_name}</p>
              <p>{store.address}</p>
              {store.landmark && <p>{store.landmark}</p>}
              <p className="pt-3 font-bold text-ink">KRA PIN: {inv.seller_kra_pin ?? "Not set"}</p>
            </div>
          </div>
          <div className="sm:border-l sm:border-line sm:pl-8">
            <p className={LABEL}>{credit ? "Credit note" : "Tax invoice"}</p>
            <p className={cx(NAVY, "mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl")}>{inv.invoice_number}</p>
            <p className={cx("mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold", paid ? "bg-mint-bg text-ink" : "bg-rose-bg text-rose-fg")}>
              {paid && <CheckCircle2 className="size-5 fill-mint-fg text-white" />}{status.label}
            </p>
          </div>
        </header>

        {/* Key facts */}
        <dl className="grid grid-cols-2 gap-y-4 border-b border-line pb-7 sm:grid-cols-4 sm:divide-x sm:divide-line">
          {[["Issued date", formatDateTimeFull(inv.issued_at)], ["Order no.", inv.order?.order_number ?? "—"],
            [credit ? "Credits invoice" : "Currency", credit ? inv.original?.invoice_number ?? "—" : "Kenya Shillings"]].map(([k, v]) => (
            <div key={k} className="sm:px-6 sm:first:pl-0"><dt className={LABEL}>{k}</dt><dd className="mt-1.5 text-[17px]">{v}</dd></div>
          ))}
          <div className="sm:px-6"><dt className={LABEL}>{credit ? "Total credited" : "Total amount"}</dt><dd className="mt-0.5 text-3xl font-extrabold text-brand-600">{kes(inv.total_amount)}</dd></div>
        </dl>

        {/* Parties */}
        <section className="grid gap-4 sm:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl bg-surface p-5">
            <p className={LABEL}>Billed to</p>
            <p className={cx(NAVY, "mt-2 text-xl font-bold")}>{inv.buyer_name ?? "Walk-in customer"}</p>
            {inv.buyer_phone && <p className="text-ink-muted">{inv.buyer_phone}</p>}
            <p className="mt-1 text-ink-muted">KRA PIN: {inv.buyer_kra_pin ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-surface p-5">
            <p className={LABEL}>{credit ? "Refund details" : "Payment details"}</p>
            {payments.length === 1 ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5">
                <dt className="text-ink-muted">Method</dt><dd>{PAYMENT_LABEL[payments[0].method]}</dd>
                <dt className="text-ink-muted">Reference</dt><dd>{payments[0].provider_reference ?? "—"}</dd>
                <dt className="text-ink-muted">Amount paid</dt><dd>{kes(payments[0].amount)}</dd>
              </dl>
            ) : payments.length ? (
              <ul className="mt-2 space-y-1.5">
                {payments.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3"><span>{PAYMENT_LABEL[p.method]} <span className="text-sm text-ink-muted">{p.provider_reference}</span></span><span>{kes(p.amount)}</span></li>
                ))}
                <li className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold"><span>Amount paid</span><span>{kes(payments.reduce((s, p) => s + p.amount, 0))}</span></li>
              </ul>
            ) : <p className="mt-2 text-ink-muted">—</p>}
          </div>
        </section>

        {/* Lines */}
        <section>
          <table className="hidden w-full sm:table">
            <thead className="bg-brand-50 text-left text-xs font-semibold uppercase tracking-[0.12em]">
              <tr>
                <th className="rounded-l-xl px-4 py-3.5">#</th><th className="px-3 py-3.5">Product</th><th className="px-3 py-3.5 text-right">Qty</th>
                <th className="px-3 py-3.5 text-right">Unit price</th><th className="px-3 py-3.5 text-right">Discount</th>
                <th className="px-3 py-3.5 text-right">{vatTitle}</th><th className="rounded-r-xl px-4 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-b border-line">
              {inv.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-4">{i + 1}</td>
                  <td className="px-3 py-4"><p className={cx(NAVY, "font-bold")}>{l.name}</p>{l.sku && <p className="text-sm text-ink-muted">{l.sku}</p>}</td>
                  <td className="px-3 py-4 text-right">{l.quantity}</td>
                  <td className="px-3 py-4 text-right">{kes(l.unit_price)}</td>
                  <td className="px-3 py-4 text-right">{l.discount ? `-${kes(l.discount)}` : "—"}</td>
                  <td className="px-3 py-4 text-right">{kes(l.tax)}{vatTitle === "VAT" && <span className="block text-xs text-ink-muted">{l.tax_type} · {l.tax_rate}%</span>}</td>
                  <td className="px-4 py-4 text-right font-bold">{kes(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line rounded-2xl border border-line sm:hidden">
            {inv.lines.map((l, i) => (
              <li key={i} className="p-4">
                <div className="flex justify-between gap-3"><p className={cx(NAVY, "font-bold")}>{l.name}</p><p className="font-bold">{kes(l.total)}</p></div>
                <p className="text-sm text-ink-muted">{l.quantity} × {kes(l.unit_price)}{l.discount ? ` · discount -${kes(l.discount)}` : ""} · VAT {l.tax_rate}% {kes(l.tax)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Tax summary and totals */}
        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className={cx(LABEL, NAVY)}>Tax summary</p>
            <table className="mt-3 w-full">
              <thead className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                <tr><th className="py-2 pl-2">Rate</th><th className="py-2 text-right">Taxable amount</th><th className="py-2 pr-2 text-right">VAT amount</th></tr>
              </thead>
              <tbody>
                {summary.map(([t, s]) => (
                  <tr key={t}><td className="py-2.5 pl-2">{t} - {TAX_TYPES[t]}</td><td className="py-2.5 text-right">{kes(s.taxable)}</td><td className="py-2.5 pr-2 text-right">{kes(s.tax)}</td></tr>
                ))}
                <tr className="bg-surface font-bold">
                  <td className="rounded-l-lg py-2.5 pl-2">Total</td>
                  <td className="py-2.5 text-right">{kes(summary.reduce((a, [, s]) => a + s.taxable, 0))}</td>
                  <td className="rounded-r-lg py-2.5 pr-2 text-right">{kes(inv.tax_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="h-fit space-y-2 rounded-2xl bg-brand-50 p-6 text-[17px]">
            <div className="flex justify-between"><dt>Subtotal (excl. VAT)</dt><dd>{kes(inv.subtotal)}</dd></div>
            {inv.discount_amount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{kes(inv.discount_amount)}</dd></div>}
            {inv.delivery_amount > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{kes(inv.delivery_amount)}</dd></div>}
            <div className="flex justify-between"><dt>{vatTitle}</dt><dd>{kes(inv.tax_amount)}</dd></div>
            <div className="!mt-4 flex items-center justify-between border-t border-brand-200 pt-4">
              <dt className={cx(NAVY, "text-2xl font-extrabold")}>{credit ? "Total credited" : "Total"}</dt>
              <dd className="text-3xl font-extrabold text-brand-600">{kes(inv.total_amount)}</dd>
            </div>
          </dl>
        </section>

        {/* eTIMS */}
        <section className={cx("flex gap-3 rounded-2xl p-5", inv.etims_status === "sent" ? "bg-mint-bg" : "bg-amber-bg")}>
          <Info className={cx("mt-0.5 size-6 shrink-0 text-white", inv.etims_status === "sent" ? "fill-mint-fg" : "fill-amber-500")} />
          <div>
            <p className="font-bold text-amber-fg">KRA eTIMS – {etims.label}</p>
            {inv.etims_status === "sent"
              ? <p>CU invoice no. {inv.etims_receipt_number} · Signature {inv.etims_signature}</p>
              : <p>{inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}Not yet transmitted to KRA. The control unit number, signature and QR code are added once eTIMS accepts it.</p>}
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-5 border-t border-line pt-7 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className={cx(NAVY, "text-lg font-bold")}>Thank you for shopping with {inv.seller_name}!</p>
            <p className="text-ink-muted">{store.hours}</p>
            <p className={cx(serif.className, "mt-2 text-3xl italic text-brand-600")}>Glow · Slay · Sparkle</p>
          </div>
          <div className="flex items-center gap-4 sm:border-l sm:border-line sm:pl-8">
            {/* KRA's QR code exists only once eTIMS accepts the invoice, so none is shown before that. */}
            <span className="grid size-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-line text-ink-muted"><QrCode className="size-9 opacity-50" /></span>
            <p className="text-sm"><span className="font-semibold">Scan for eTIMS verification</span><span className="block text-ink-muted">(Available after transmission)</span></p>
          </div>
        </footer>
      </div>
    </article>
  );
}
