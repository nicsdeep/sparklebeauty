import { Badge } from "@/components/ui";
import { formatDateTime, kes } from "@/lib/format";
import { ETIMS_META, type Invoice } from "@/lib/invoices";
import type { StoreSettings } from "@/lib/store-types";
import { TAX_TYPES, type TaxType } from "@/lib/tax";

/** A KRA tax invoice or credit note, laid out to print on A4. Used by admin and the customer's order page. */
export function InvoiceDocument({ invoice: inv, store }: { invoice: Invoice; store: StoreSettings }) {
  const credit = inv.kind === "credit_note";
  const summary = (Object.entries(inv.tax_summary) as [TaxType, { rate: number; taxable: number; tax: number }][]).sort(([a], [b]) => a.localeCompare(b));
  return (
    <article className="rounded-2xl border border-line bg-white p-6 text-[15px] print:rounded-none print:border-0 print:p-0 sm:p-8">
      <header className="flex flex-wrap justify-between gap-6 border-b border-line pb-5">
        <div>
          <p className="text-xl font-extrabold text-brand-600">{inv.seller_name}</p>
          <p className="text-sm text-ink-muted">{store.address}{store.phones[0] ? ` · ${store.phones[0].number}` : ""}</p>
          <p className="text-sm">KRA PIN: <strong className="font-mono">{inv.seller_kra_pin ?? "not set"}</strong></p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight">{credit ? "CREDIT NOTE" : "TAX INVOICE"}</p>
          <p className="font-mono font-semibold">{inv.invoice_number}</p>
          <p className="text-sm text-ink-muted">{formatDateTime(inv.issued_at)}</p>
          {inv.order && <p className="text-sm text-ink-muted">Order {inv.order.order_number}</p>}
          {credit && inv.original && <p className="text-sm">Against invoice <strong className="font-mono">{inv.original.invoice_number}</strong></p>}
        </div>
      </header>

      <section className="grid gap-1 border-b border-line py-4 text-sm sm:grid-cols-2">
        <p><span className="text-ink-muted">Customer: </span><strong>{inv.buyer_name ?? "Walk-in customer"}</strong>{inv.buyer_phone ? ` · ${inv.buyer_phone}` : ""}</p>
        <p className="sm:text-right"><span className="text-ink-muted">Customer KRA PIN: </span><strong className="font-mono">{inv.buyer_kra_pin ?? "—"}</strong></p>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-ink-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-semibold">Item</th><th className="py-2 pr-3 text-right font-semibold">Qty</th>
              <th className="py-2 pr-3 text-right font-semibold">Unit price</th><th className="py-2 pr-3 text-right font-semibold">Discount</th>
              <th className="py-2 pr-3 text-right font-semibold">Taxable</th><th className="py-2 pr-3 font-semibold">Tax</th>
              <th className="py-2 pr-3 text-right font-semibold">VAT</th><th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-3">{l.name}{l.sku && <span className="block font-mono text-xs text-ink-muted">{l.sku}</span>}</td>
                <td className="py-2 pr-3 text-right">{l.quantity}</td>
                <td className="py-2 pr-3 text-right">{kes(l.unit_price)}</td>
                <td className="py-2 pr-3 text-right">{l.discount ? `-${kes(l.discount)}` : "—"}</td>
                <td className="py-2 pr-3 text-right">{kes(l.taxable)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{l.tax_type} · {l.tax_rate}%</td>
                <td className="py-2 pr-3 text-right">{kes(l.tax)}</td>
                <td className="py-2 text-right font-semibold">{kes(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-5 grid gap-6 sm:grid-cols-2">
        <table className="h-fit text-sm">
          <thead className="text-left text-ink-muted"><tr><th className="pb-1 pr-4 font-semibold">Tax type</th><th className="pb-1 pr-4 text-right font-semibold">Taxable</th><th className="pb-1 text-right font-semibold">VAT</th></tr></thead>
          <tbody>
            {summary.map(([t, s]) => (
              <tr key={t}><td className="pr-4">{t} · {TAX_TYPES[t]}</td><td className="pr-4 text-right">{kes(s.taxable)}</td><td className="text-right">{kes(s.tax)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 text-sm sm:justify-self-end sm:min-w-64">
          <div className="flex justify-between gap-6"><dt>Subtotal (before VAT)</dt><dd>{kes(inv.subtotal)}</dd></div>
          {inv.discount_amount > 0 && <div className="flex justify-between gap-6"><dt>Discount</dt><dd>-{kes(inv.discount_amount)}</dd></div>}
          {inv.delivery_amount > 0 && <div className="flex justify-between gap-6"><dt>Delivery</dt><dd>{kes(inv.delivery_amount)}</dd></div>}
          <div className="flex justify-between gap-6"><dt>VAT</dt><dd>{kes(inv.tax_amount)}</dd></div>
          <div className="flex justify-between gap-6 border-t border-line pt-1.5 text-base font-bold"><dt>{credit ? "Total credited" : "Total"}</dt><dd>{kes(inv.total_amount)}</dd></div>
        </dl>
      </section>

      <footer className="mt-6 rounded-xl bg-surface p-4 text-sm print:bg-transparent print:px-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">KRA eTIMS <Badge tone={ETIMS_META[inv.etims_status].tone}>{ETIMS_META[inv.etims_status].label}</Badge></p>
        {inv.etims_status === "sent" ? (
          <p className="mt-1">CU invoice no. <strong className="font-mono">{inv.etims_receipt_number}</strong> · signature <span className="font-mono">{inv.etims_signature}</span>{inv.etims_sent_at ? ` · ${formatDateTime(inv.etims_sent_at)}` : ""}</p>
        ) : (
          <p className="mt-1 text-ink-muted">
            {inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}
            Not yet transmitted to KRA. The control unit invoice number, signature and QR code are added once eTIMS accepts it.
          </p>
        )}
      </footer>
    </article>
  );
}
