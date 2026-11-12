import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/format";
import { vatHeading } from "@/lib/invoices";
import { receiptFromPublic, type ReceiptData } from "@/lib/receipt";

/**
 * The receipt for an order, by id (admin) or order number (customer). RLS decides who may read
 * it. The cashier's name shows only to staff (customers can't read staff profiles).
 * Cash handed over and change are known only at the till, so a reprint shows the amount paid.
 */
export async function loadReceipt(by: { id: string } | { number: string }): Promise<ReceiptData | null> {
  const supabase = await createClient();
  let q = supabase.from("orders").select(`order_number, created_at, created_by, receipt_token, customer_name, subtotal, discount_amount, delivery_amount, tax_amount, total_amount, prices_include_vat,
    cashier:profiles!orders_created_by_fkey(full_name),
    order_items(product_name, sku, quantity, line_total, discount_amount, tax_amount, tax_rate),
    payments(method, amount, provider_reference, status, created_at),
    invoices(invoice_number, kind)`);
  q = "id" in by ? q.eq("id", by.id) : q.eq("order_number", by.number);
  const { data: o } = await q.maybeSingle();
  if (!o) return null;

  const items = (o.order_items ?? []) as { product_name: string; sku: string | null; quantity: number; line_total: number; discount_amount: number; tax_amount: number; tax_rate: number }[];
  const payments = ((o.payments ?? []) as { method: PaymentMethod; amount: number; provider_reference: string | null; status: string; created_at: string }[])
    .filter((p) => p.status === "paid" || p.status === "refunded").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const invoice = ((o.invoices ?? []) as { invoice_number: string; kind: string }[]).find((i) => i.kind === "invoice");
  return {
    number: o.order_number,
    issuedAt: o.created_at,
    cashier: (o.cashier as unknown as { full_name: string | null } | null)?.full_name ?? null,
    // Rung up by staff at the till, or placed by the customer online (incl. wholesale accounts).
    channel: o.created_by ? "till" : "online",
    customer: o.customer_name ?? "Walk-in customer",
    lines: items.map((l) => ({ quantity: l.quantity, name: l.product_name, sku: l.sku,
      amount: Math.round((Number(l.line_total) - Number(l.discount_amount) + (o.prices_include_vat ? 0 : Number(l.tax_amount))) * 100) / 100 })),
    subtotal: Number(o.subtotal),
    discount: Number(o.discount_amount),
    delivery: Number(o.delivery_amount),
    tax: Number(o.tax_amount),
    vatLabel: vatHeading(items.map((l) => Number(l.tax_rate))),
    vatIncluded: o.prices_include_vat === true,
    total: Number(o.total_amount),
    payments: payments.map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.provider_reference })),
    invoiceNumber: invoice?.invoice_number ?? null,
    token: o.receipt_token,
  };
}

/** The receipt behind a private link (anyone with the link; paid orders only). */
export async function loadPublicReceipt(token: string): Promise<ReceiptData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_receipt", { p_token: token });
  return data ? receiptFromPublic(data as Record<string, unknown>, token) : null;
}
