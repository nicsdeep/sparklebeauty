import { DM_Serif_Display, Great_Vibes } from "next/font/google";
import { CheckCircle2, Info, QrCode } from "lucide-react";
import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META } from "@/lib/format";
import { ETIMS_META, INVOICE_FOOTER_CATEGORIES, vatHeading, type InvoiceBundle } from "@/lib/invoices";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { cx } from "@/components/ui";

// Nicholas's invoice template (2026-10-31, second version). The PDF (lib/invoice-pdf.tsx) follows the same layout.
const serif = DM_Serif_Display({ weight: "400", subsets: ["latin"] });
const script = Great_Vibes({ weight: "400", subsets: ["latin"] });
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
        <section className={cx("flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center", inv.etims_status === "sent" ? "bg-mint-bg" : "bg-amber-bg")}>
          <Info className={cx("size-6 shrink-0 text-white sm:self-start", inv.etims_status === "sent" ? "fill-mint-fg" : "fill-amber-500")} />
          <div className="flex-1">
            <p className="font-bold text-amber-fg">KRA eTIMS – {etims.label}</p>
            {inv.etims_status === "sent"
              ? <p>CU invoice no. {inv.etims_receipt_number} · Signature {inv.etims_signature}</p>
              : <p>{inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}Not yet transmitted to KRA. The control unit number, signature and QR code are added once eTIMS accepts it.</p>}
          </div>
          <div className="flex items-center gap-3 sm:border-l sm:border-amber-fg/20 sm:pl-5">
            {/* KRA's QR code exists only once eTIMS accepts the invoice, so none is shown before that. */}
            <span className="grid size-16 shrink-0 place-items-center rounded-lg border-2 border-dashed border-amber-fg/30 bg-white/60 text-ink-muted"><QrCode className="size-8 opacity-50" /></span>
            <p className="text-sm"><span className="font-semibold">Scan for eTIMS verification</span><span className="block text-ink-muted">(Available after transmission)</span></p>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="relative overflow-hidden border-t border-line px-6 pb-8 pt-7 text-center sm:px-10">
        <svg aria-hidden viewBox="0 0 800 160" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-32 w-full">
          <path d="M0 60 C 180 10, 330 110, 520 60 S 760 20, 800 40 L 800 160 L 0 160 Z" fill="#fdf0f6" />
          <path d="M0 95 C 200 55, 360 140, 560 95 S 760 70, 800 85 L 800 160 L 0 160 Z" fill="#fbe1ee" opacity="0.6" />
        </svg>
        <svg aria-hidden viewBox="0 0 120 140" className="absolute -right-2 bottom-2 h-36 w-auto opacity-70">
          <path d="M100 135 C 90 95, 70 60, 30 20" stroke="#f6c3dd" strokeWidth="2" fill="none" />
          {[[78, 95, -30], [62, 70, -40], [46, 48, -55], [88, 78, 25], [70, 52, 15], [54, 32, 5]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx="16" ry="6.5" transform={`rotate(${r} ${x} ${y})`} fill="#f6c3dd" opacity={0.55 + (i % 3) * 0.12} />
          ))}
        </svg>
        <div className="relative">
          <p className="text-sm text-ink-muted">Thank you for shopping with {inv.seller_name} · {store.hours}{store.whatsapp ? ` · WhatsApp ${store.whatsapp}` : ""}</p>
          <p className={cx(script.className, "mt-3 text-5xl leading-tight text-brand-600")}>Glow · Slay · Sparkle</p>
          <svg aria-hidden viewBox="0 0 240 20" className="mx-auto -mt-1 h-5 w-60 text-brand-600">
            <path d="M5 10 C 70 16, 100 14, 112 11 M128 11 C 140 14, 170 16, 235 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M120 16 C 112 10, 112 5, 116 4.5 C 118.5 4.2, 120 6, 120 7.5 C 120 6, 121.5 4.2, 124 4.5 C 128 5, 128 10, 120 16 Z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          </svg>
          <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
            {INVOICE_FOOTER_CATEGORIES.map((c, i) => <span key={c}>{i > 0 && <span className="mr-3 text-ink-muted">|</span>}{c}</span>)}
          </p>
        </div>
      </footer>
    </article>
  );
}
