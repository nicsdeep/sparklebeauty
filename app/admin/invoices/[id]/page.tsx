import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { INVOICE_SELECT, toInvoice } from "@/lib/invoices";
import { getStoreSettings } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, store] = await Promise.all([supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle(), getStoreSettings()]);
  if (!data) notFound();
  const invoice = toInvoice(data);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/invoices" className="font-semibold text-brand-700">← All invoices</Link>
        <PrintButton label={invoice.kind === "credit_note" ? "Print credit note" : "Print invoice"} />
      </div>
      <InvoiceDocument invoice={invoice} store={store} />
    </div>
  );
}
