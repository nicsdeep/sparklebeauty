import { kes, type PaymentMethod } from "@/lib/format";
import { vatHeading } from "@/lib/invoices";
import type { StoreSettings } from "@/lib/store-types";

// One receipt for the whole system (Nicholas's receipt design, 2026-11-02): the till after a sale
// or a reprint, the PDF and WhatsApp message, and the receipt pages for admin and customers.
// The receipt number is the order number customers already see (SPK-…).

export type ReceiptData = {
  number: string;
  issuedAt: string;
  /** Staff member who rang up the sale; null when not visible to the reader. */
  cashier: string | null;
  /** Sold at the till or in the online shop. */
  channel: "till" | "online";
  customer: string;
  /** Each line's amount as the customer pays it (VAT included). */
  lines: { quantity: number; name: string; sku: string | null; amount: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  tax: number;
  /** e.g. "VAT (16%)", or "VAT" when lines have different rates. */
  vatLabel: string;
  /** VAT is inside the prices (orders from 2026-11-11): shown as "Includes VAT", not added to the total. */
  vatIncluded: boolean;
  total: number;
  payments: { method: PaymentMethod; amount: number; reference: string | null }[];
  /** Cash handed over and change, known only at the till right after the sale. */
  cashReceived?: number;
  change?: number;
  invoiceNumber: string | null;
  pointsEarned?: number;
  offline?: boolean;
  /** Token of the private receipt link (/r/<token>) customers get on WhatsApp; null for offline sales. */
  token: string | null;
};

/** WhatsApp/email message with the private link where the customer views and downloads the receipt PDF. */
export function receiptMessage(r: ReceiptData, store: StoreSettings, link: string) {
  return `Hi! Thank you for shopping at ${store.name}. Here is your receipt ${r.number} (${kes(r.total)}). View or download it as a PDF: ${link}`;
}

/** Receipt from public_receipt() (the private link page). */
export function receiptFromPublic(j: Record<string, unknown>, token: string): ReceiptData {
  const n = (v: unknown) => Number(v ?? 0);
  const lines = (j.lines as { quantity: number; name: string; sku: string | null; amount: number; tax_rate: number }[]) ?? [];
  return {
    number: String(j.number), issuedAt: String(j.issued_at), cashier: (j.cashier as string | null) ?? null, channel: j.channel === "online" ? "online" : "till",
    customer: String(j.customer), lines: lines.map((l) => ({ quantity: n(l.quantity), name: l.name, sku: l.sku, amount: n(l.amount) })),
    subtotal: n(j.subtotal), discount: n(j.discount), delivery: n(j.delivery), tax: n(j.tax),
    vatLabel: vatHeading(lines.map((l) => n(l.tax_rate))), vatIncluded: j.prices_include_vat === true, total: n(j.total),
    payments: ((j.payments as { method: PaymentMethod; amount: number; reference: string | null }[]) ?? []).map((p) => ({ ...p, amount: n(p.amount) })),
    invoiceNumber: (j.invoice_number as string | null) ?? null, token,
  };
}
