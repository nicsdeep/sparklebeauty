import { Fragment, type CSSProperties } from "react";
import { Dancing_Script, Inter } from "next/font/google";
import { QrCode } from "lucide-react";
import { cx } from "@/components/ui";
import { formatDateTimeFull, kes, PAYMENT_LABEL } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipt";
import type { StoreSettings } from "@/lib/store-types";

// The one receipt used everywhere (Nicholas's design and spec, 2026-11-02): an 80 mm till-roll
// slip, about 85% white and navy text, 10% light gray, 5% Sparkle pink/blue accents.
// `receipt-print` makes it the only thing printed, on an 80 mm page (globals.css).
//   Inter (400/500/600/700) for everything; Dancing Script only for the thank-you line.
//   Money: tabular figures, right-aligned, navy; Sparkle pink only for the final total.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const script = Dancing_Script({ subsets: ["latin"], weight: ["500"] });

const C = {
  pink: "#E6007E", navy: "#0F1738", body: "#252B3A", muted: "#6B7280",
  line: "#D7DCE5", dash: "#9CA3AF", gray: "#F7F8FA", pinkSoft: "#FDEBF3",
};
const money: CSSProperties = { fontVariantNumeric: "tabular-nums" };
const Solid = () => <div className="my-3" style={{ borderTop: `1px solid ${C.line}` }} />;
const Dashed = () => <div className="my-3" style={{ borderTop: `1px dashed ${C.dash}` }} />;

/** Torn-paper edge along the top or bottom of the slip (screen only). */
function Edge({ bottom }: { bottom?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 120 6" preserveAspectRatio="none" className={cx("block h-2 w-full text-white print:hidden", bottom && "rotate-180")}>
      <path d="M0 6 L0 3 L5 0 L10 3 L15 0 L20 3 L25 0 L30 3 L35 0 L40 3 L45 0 L50 3 L55 0 L60 3 L65 0 L70 3 L75 0 L80 3 L85 0 L90 3 L95 0 L100 3 L105 0 L110 3 L115 0 L120 3 L120 6 Z" fill="currentColor" />
    </svg>
  );
}

/** A label/amount row, amount right-aligned in tabular figures. */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <dt style={{ color: C.body }}>{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"} style={{ ...money, color: C.navy }}>{value}</dd>
    </div>
  );
}

export function ReceiptDocument({ receipt: r, store, className }: { receipt: ReceiptData; store: StoreSettings; className?: string }) {
  const d = new Date(r.issuedAt);
  const date = d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
  const time = d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Nairobi" }).toUpperCase();
  const meta: [string, string][] = [["No:", r.number], ["Date:", date], ["Time:", time]];
  if (r.channel === "online") meta.push(["Sold:", "Online shop"]);
  else if (r.cashier) meta.push(["Cashier:", r.cashier]);
  meta.push(["Customer:", r.customer]);
  // What the customer handed over: the cash given at the till (when known) plus M-Pesa, card and bank.
  const cashKept = r.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  const handedOver = r.payments.reduce((s, p) => s + p.amount, 0) - cashKept + (r.cashReceived ?? cashKept);

  return (
    <div className={cx(inter.className, "receipt-print mx-auto w-full max-w-[320px] drop-shadow-[0_10px_24px_rgba(15,23,56,0.14)] print:drop-shadow-none", className)}
      style={{ fontFamily: `${inter.style.fontFamily}, Arial, Helvetica, sans-serif`, color: C.body }} title={formatDateTimeFull(r.issuedAt)}>
      <Edge />
      <article className="bg-white px-6 pb-5 pt-4 leading-snug">
        {/* Shop */}
        <header className="text-center text-[11.5px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sparkle-logo.svg" alt={store.name} width={1313} height={1116} className="mx-auto h-auto w-[110px]" />
          <p className="mt-2">{store.address}</p>
          {store.landmark && <p>{store.landmark}</p>}
          {store.kra_pin && <p className="mt-1"><span className="font-semibold" style={{ color: C.navy }}>KRA PIN:</span> {store.kra_pin}</p>}
        </header>

        <Dashed />
        <h2 className="text-center text-[24px] font-bold tracking-tight" style={{ color: C.navy }}>RECEIPT</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[11.5px]">
          {meta.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className="font-medium" style={{ color: C.navy }}>{v}</dd></Fragment>)}
        </dl>
        {r.offline && <p className="mt-2 rounded px-2 py-1 text-center text-[10.5px]" style={{ background: C.gray, color: C.muted }}>Taken offline · recorded when the till reconnects</p>}

        <Dashed />
        {/* Items */}
        <div className="grid grid-cols-[1.75rem_1fr_auto] rounded-[5px] px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ background: C.pinkSoft, color: C.navy }}>
          <span>Qty</span><span>Item</span><span className="text-right">Amount</span>
        </div>
        <ul>
          {r.lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr_auto] gap-x-1 px-2 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span className="text-[12.5px]" style={{ ...money, color: C.navy }}>{l.quantity}</span>
              <span>
                <span className="block text-[12.5px] font-semibold" style={{ color: C.navy }}>{l.name}</span>
                {l.sku && <span className="block text-[9.5px]" style={{ color: C.muted }}>{l.sku}</span>}
              </span>
              <span className="text-right text-[12.5px] font-semibold" style={{ ...money, color: C.navy }}>{kes(l.amount)}</span>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <dl className="mt-3 space-y-0.5">
          <Row label="Subtotal (excl. VAT)" value={kes(r.subtotal)} strong />
          {r.discount > 0 && <Row label="Discount" value={`-${kes(r.discount)}`} strong />}
          {r.delivery > 0 && <Row label="Delivery" value={kes(r.delivery)} strong />}
          {r.tax > 0 && <Row label={r.vatLabel} value={kes(r.tax)} strong />}
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-[5px] px-3 py-2.5" style={{ background: C.pinkSoft }}>
          <span className="text-[21px] font-bold uppercase" style={{ color: C.navy }}>Total</span>
          <span className="text-[24px] font-bold" style={{ ...money, color: C.pink }}>{kes(r.total)}</span>
        </div>

        {/* Payment */}
        <Solid />
        <dl className="space-y-0.5">
          {r.payments.length === 1
            ? <Row label="Payment method:" value={PAYMENT_LABEL[r.payments[0].method]} />
            : r.payments.map((p, i) => <Row key={i} label={`${PAYMENT_LABEL[p.method]}:`} value={kes(p.amount)} />)}
          {r.payments.length === 1 && r.payments[0].reference && <Row label="Reference:" value={r.payments[0].reference} />}
          <Row label="Amount paid:" value={kes(handedOver)} strong />
          {!!r.change && <Row label="Change:" value={kes(r.change)} strong />}
        </dl>
        {(!!r.pointsEarned || r.invoiceNumber) && (
          <dl className="mt-1 space-y-0.5 text-[11px]" style={{ color: C.muted }}>
            {!!r.pointsEarned && <div className="flex justify-between"><dt>Loyalty points earned</dt><dd style={money}>+{r.pointsEarned}</dd></div>}
            {r.invoiceNumber && <div className="flex justify-between"><dt>Tax invoice</dt><dd>{r.invoiceNumber}</dd></div>}
          </dl>
        )}

        {/* Thanks, eTIMS, slogan */}
        <Dashed />
        <p className={cx(script.className, "text-center text-[21px]")} style={{ color: C.navy }}>Thank you for shopping with us.</p>
        <div className="mt-3 flex flex-col items-center gap-1.5 text-center">
          {/* Black-on-white QR from KRA once eTIMS accepts the sale; until then an empty, labelled space. */}
          <span className="grid size-[85px] place-items-center rounded" style={{ border: `1px dashed ${C.dash}`, color: C.muted }}><QrCode className="size-9 opacity-40" /></span>
          <p className="text-[10.5px]" style={{ color: C.body }}>Scan to verify receipt (eTIMS)</p>
          <p className="text-[9.5px]" style={{ color: C.muted }}>Available once sent to KRA</p>
        </div>
        <Solid />
        <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.25em]" style={{ color: C.pink }}>Glow • Slay • Sparkle</p>
      </article>
      <Edge bottom />
    </div>
  );
}
