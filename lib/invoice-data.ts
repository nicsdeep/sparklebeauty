import { createClient } from "@/lib/supabase/server";
import { INVOICE_SELECT, INVOICE_SELECT_BY_ORDER, toInvoice, type InvoiceBundle } from "@/lib/invoices";
import { getStoreSettings } from "@/lib/store";
import type { PaymentMethod } from "@/lib/format";

async function withOrder(rows: Record<string, unknown>[]): Promise<InvoiceBundle[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const invoices = rows.map(toInvoice);
  const [{ data: order }, store] = await Promise.all([
    supabase.from("orders").select("payment_status, payments(method, amount, provider_reference, status)").eq("id", invoices[0].order_id).maybeSingle(),
    getStoreSettings(),
  ]);
  const payments = ((order?.payments ?? []) as { method: PaymentMethod; amount: number; provider_reference: string | null; status: string }[])
    .filter((p) => p.status === "paid" || p.status === "refunded")
    .map((p) => ({ method: p.method, amount: Number(p.amount), provider_reference: p.provider_reference }));
  return invoices.map((invoice) => ({ invoice, payments, paymentStatus: order?.payment_status ?? "paid", store }));
}

/** One invoice by id (staff; RLS decides). */
export async function loadInvoice(id: string): Promise<InvoiceBundle | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();
  return data ? (await withOrder([data]))[0] : null;
}

/** An order's invoice and any credit note, oldest first (RLS: the customer's own orders, or staff). */
export async function loadOrderInvoices(orderNumber: string): Promise<InvoiceBundle[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select(INVOICE_SELECT_BY_ORDER).eq("order.order_number", orderNumber).order("issued_at");
  return withOrder(data ?? []);
}
