import { formatDateTimeFull, kes, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import { mainWhatsapp, type StoreSettings } from "@/lib/store-types";

// One receipt for the whole system (Nicholas's receipt design, 2026-11-02): the till after a sale
// or a reprint, the WhatsApp/email copy, and the receipt pages for admin and customers.
// The receipt number is the order number customers already see (SPK-…).

export type ReceiptData = {
  number: string;
  issuedAt: string;
  /** Staff member who rang up the sale; null when not visible to the reader. */
  cashier: string | null;
  /** Sold at the till or in the online shop. */
  channel: "till" | "online";
  customer: string;
  /** Each line's amount includes its VAT, as the customer pays it. */
  lines: { quantity: number; name: string; sku: string | null; amount: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  tax: number;
  /** e.g. "VAT (16%)", or "VAT" when lines have different rates. */
  vatLabel: string;
  total: number;
  payments: { method: PaymentMethod; amount: number; reference: string | null }[];
  /** Cash handed over and change, known only at the till right after the sale. */
  cashReceived?: number;
  change?: number;
  invoiceNumber: string | null;
  pointsEarned?: number;
  offline?: boolean;
};

/** Plain-text copy for WhatsApp or email. */
export function receiptText(r: ReceiptData, store: StoreSettings) {
  const wa = mainWhatsapp(store);
  return [
    `${store.name}`, `Receipt ${r.number} · ${formatDateTimeFull(r.issuedAt)}`, store.kra_pin ? `KRA PIN: ${store.kra_pin}` : "", "",
    ...r.lines.map((l) => `${l.quantity} x ${l.name}  ${kes(l.amount)}`), "",
    `Subtotal (excl. VAT): ${kes(r.subtotal)}`,
    r.discount ? `Discount: -${kes(r.discount)}` : "",
    r.delivery ? `Delivery: ${kes(r.delivery)}` : "",
    r.tax ? `${r.vatLabel}: ${kes(r.tax)}` : "",
    `TOTAL: ${kes(r.total)}`,
    `Paid: ${r.payments.map((p) => `${PAYMENT_LABEL[p.method]} ${kes(p.amount)}`).join(" + ") || "—"}`,
    r.change ? `Cash ${kes(r.cashReceived)}, change ${kes(r.change)}` : "",
    r.invoiceNumber ? `Tax invoice: ${r.invoiceNumber}` : "",
    "", "Thank you for shopping with us. Glow · Slay · Sparkle", wa ? `WhatsApp ${wa}` : "",
  ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
}
