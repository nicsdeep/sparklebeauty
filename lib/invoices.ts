import type { PaymentMethod, Tone } from "@/lib/format";
import type { StoreSettings } from "@/lib/store-types";
import type { TaxType } from "@/lib/tax";

// Tax invoices and credit notes (public.invoices). They are issued by the database when an order
// is paid or refunded, and wait in the KRA eTIMS queue until the eTIMS connection is set up.

export type InvoiceLine = {
  name: string; sku: string | null; quantity: number; unit_price: number; amount: number;
  discount: number; taxable: number; tax_type: TaxType; tax_rate: number; tax: number; total: number;
};
export type EtimsStatus = "pending" | "sent" | "failed";
export type Invoice = {
  id: string;
  kind: "invoice" | "credit_note";
  invoice_number: string;
  order_id: string;
  original_invoice_id: string | null;
  issued_at: string;
  seller_name: string;
  seller_kra_pin: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_kra_pin: string | null;
  lines: InvoiceLine[];
  tax_summary: Partial<Record<TaxType, { rate: number; taxable: number; tax: number }>>;
  subtotal: number;
  discount_amount: number;
  delivery_amount: number;
  tax_amount: number;
  total_amount: number;
  etims_status: EtimsStatus;
  etims_receipt_number: string | null;
  etims_signature: string | null;
  etims_sent_at: string | null;
  etims_error: string | null;
  order?: { order_number: string } | null;
  original?: { invoice_number: string } | null;
};

/** Everything an invoice page or PDF shows: the invoice, how the order was paid, and the shop details. */
export type InvoiceBundle = {
  invoice: Invoice;
  payments: { method: PaymentMethod; amount: number; provider_reference: string | null }[];
  paymentStatus: string;
  store: StoreSettings;
};

export const INVOICE_SELECT = "*, order:orders(order_number), original:original_invoice_id(invoice_number)";
/** Same, filterable by order number (inner join). */
export const INVOICE_SELECT_BY_ORDER = "*, order:orders!inner(order_number), original:original_invoice_id(invoice_number)";

export const ETIMS_META: Record<EtimsStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting for eTIMS", tone: "amber" },
  sent: { label: "Sent to KRA", tone: "mint" },
  failed: { label: "eTIMS failed", tone: "rose" },
};

/** Numerics arrive as strings from Postgres. */
export function toInvoice(r: Record<string, unknown>): Invoice {
  const n = (v: unknown) => Number(v ?? 0);
  const row = r as unknown as Invoice;
  return {
    ...row,
    lines: (row.lines ?? []).map((l) => ({ ...l, quantity: n(l.quantity), unit_price: n(l.unit_price), amount: n(l.amount), discount: n(l.discount),
      taxable: n(l.taxable), tax_rate: n(l.tax_rate), tax: n(l.tax), total: n(l.total) })),
    subtotal: n(row.subtotal), discount_amount: n(row.discount_amount), delivery_amount: n(row.delivery_amount),
    tax_amount: n(row.tax_amount), total_amount: n(row.total_amount),
  };
}

/** VAT column title: "VAT (16%)" when every line has the same rate, else "VAT" (rates shown per line). */
export function vatHeading(rates: number[]) {
  const unique = [...new Set(rates)];
  return unique.length === 1 && unique[0] > 0 ? `VAT (${unique[0]}%)` : "VAT";
}
