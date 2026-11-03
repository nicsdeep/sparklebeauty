import { Fragment } from "react";
import { Great_Vibes } from "next/font/google";
import { QrCode } from "lucide-react";
import { cx } from "@/components/ui";
import { formatDateTimeFull, kes, PAYMENT_LABEL } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipt";
import type { StoreSettings } from "@/lib/store-types";

// Nicholas's receipt design (td2/Sparkle Beauty Receipt Mockup.png, 2026-11-02), used everywhere a
// receipt is shown. `receipt-print` makes it the only thing printed, at till-roll width (globals.css).
const script = Great_Vibes({ weight: "400", subsets: ["latin"] });
const NAVY = "text-[#1c2150]";

/** Torn-paper edge along the top or bottom of the slip. */
function Edge({ bottom }: { bottom?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 120 6" preserveAspectRatio="none" className={cx("block h-2 w-full text-white print:hidden", bottom && "rotate-180")}>
      <path d="M0 6 L0 3 L5 0 L10 3 L15 0 L20 3 L25 0 L30 3 L35 0 L40 3 L45 0 L50 3 L55 0 L60 3 L65 0 L70 3 L75 0 L80 3 L85 0 L90 3 L95 0 L100 3 L105 0 L110 3 L115 0 L120 3 L120 6 Z" fill="currentColor" />
    </svg>
  );
}

export function ReceiptDocument({ receipt: r, store, className }: { receipt: ReceiptData; store: StoreSettings; className?: string }) {
  const [date, time] = (() => {
    const d = new Date(r.issuedAt);
    return [d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }),
      d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Nairobi" }).toUpperCase()];
  })();
  const rows: [string, string][] = [["No:", r.number], ["Date:", date], ["Time:", time]];
  if (r.channel === "online") rows.push(["Sold:", "Online shop"]);
  else if (r.cashier) rows.push(["Cashier:", r.cashier]);
  rows.push(["Customer:", r.customer]);
  // What the customer handed over: the cash given at the till (when known) plus M-Pesa, card and bank.
  const cashKept = r.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  const handedOver = r.payments.reduce((s, p) => s + p.amount, 0) - cashKept + (r.cashReceived ?? cashKept);

  return (
    <div className={cx("receipt-print mx-auto w-full max-w-[340px] drop-shadow-[0_10px_24px_rgba(31,26,29,0.16)] print:drop-shadow-none", className)} title={formatDateTimeFull(r.issuedAt)}>
      <Edge />
      <article className="bg-white px-6 pb-5 pt-4 text-[13px] leading-snug text-ink">
        {/* Shop */}
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sparkle-logo.svg" alt={store.name} width={1313} height={1116} className="mx-auto h-24 w-auto" />
          <p className="mt-2">{store.address}</p>
          {store.landmark && <p>{store.landmark}</p>}
          {store.kra_pin && <p className="mt-1"><strong>KRA PIN:</strong> {store.kra_pin}</p>}
        </header>

        <div className="my-3 border-t border-dashed border-ink-muted/50" />
        <h2 className={cx(NAVY, "text-center text-3xl font-extrabold tracking-tight")}>RECEIPT</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
          {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
        </dl>
        {r.offline && <p className="mt-2 rounded-md bg-amber-bg px-2 py-1 text-center text-xs text-amber-fg">Taken offline · recorded when the till reconnects</p>}

        <div className="my-3 border-t border-dashed border-ink-muted/50" />
        {/* Items */}
        <div className="grid grid-cols-[2rem_1fr_auto] rounded-md bg-brand-50 px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] print:bg-transparent print:px-0">
          <span>Qty</span><span>Item</span><span className="text-right">Amount</span>
        </div>
        <ul className="divide-y divide-line border-b border-line">
          {r.lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr_auto] gap-x-1 px-2 py-2 print:px-0">
              <span>{l.quantity}</span>
              <span><span className={cx(NAVY, "block font-bold")}>{l.name}</span>{l.sku && <span className="block text-xs text-ink-muted">{l.sku}</span>}</span>
              <span className="text-right font-semibold">{kes(l.amount)}</span>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <dl className="mt-3 space-y-0.5">
          <div className="flex justify-between"><dt>Subtotal (excl. VAT)</dt><dd className="font-semibold">{kes(r.subtotal)}</dd></div>
          {r.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd className="font-semibold">-{kes(r.discount)}</dd></div>}
          {r.delivery > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd className="font-semibold">{kes(r.delivery)}</dd></div>}
          {r.tax > 0 && <div className="flex justify-between"><dt>{r.vatLabel}</dt><dd className="font-semibold">{kes(r.tax)}</dd></div>}
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 print:bg-transparent print:px-0">
          <span className={cx(NAVY, "text-xl font-extrabold")}>Total</span>
          <span className="text-2xl font-extrabold text-brand-600">{kes(r.total)}</span>
        </div>

        {/* Payment */}
        <div className="my-3 border-t border-line" />
        <dl className="space-y-0.5">
          {r.payments.length === 1 ? (
            <div className="flex justify-between"><dt>Payment method:</dt><dd className="font-semibold">{PAYMENT_LABEL[r.payments[0].method]}</dd></div>
          ) : r.payments.map((p, i) => (
            <div key={i} className="flex justify-between"><dt>{PAYMENT_LABEL[p.method]}:</dt><dd className="font-semibold">{kes(p.amount)}</dd></div>
          ))}
          {r.payments.length === 1 && r.payments[0].reference && <div className="flex justify-between"><dt>Reference:</dt><dd className="font-semibold">{r.payments[0].reference}</dd></div>}
          <div className="flex justify-between"><dt>Amount paid:</dt><dd className="font-semibold">{kes(handedOver)}</dd></div>
          {!!r.change && <div className="flex justify-between"><dt>Change:</dt><dd className="font-semibold">{kes(r.change)}</dd></div>}
          {!!r.pointsEarned && <div className="flex justify-between text-ink-muted"><dt>Loyalty points earned:</dt><dd>+{r.pointsEarned}</dd></div>}
          {r.invoiceNumber && <div className="flex justify-between text-ink-muted"><dt>Tax invoice:</dt><dd>{r.invoiceNumber}</dd></div>}
        </dl>

        {/* Thanks, eTIMS, slogan */}
        <div className="my-3 border-t border-dashed border-ink-muted/50" />
        <p className={cx(script.className, NAVY, "text-center text-3xl")}>Thank you for shopping with us.</p>
        <div className="mt-3 flex flex-col items-center gap-1 text-center text-xs">
          {/* KRA's QR code exists only once eTIMS accepts the sale, so none is shown before that. */}
          <span className="grid size-16 place-items-center rounded-md border-2 border-dashed border-line text-ink-muted"><QrCode className="size-8 opacity-50" /></span>
          <p>Scan to verify receipt (eTIMS)</p>
          <p className="text-ink-muted">Available once sent to KRA</p>
        </div>
        <div className="mt-3 border-t border-line pt-3 text-center text-xs font-bold tracking-[0.35em] text-brand-600">GLOW • SLAY • SPARKLE</div>
      </article>
      <Edge bottom />
    </div>
  );
}
