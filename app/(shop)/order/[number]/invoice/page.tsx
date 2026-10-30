import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { INVOICE_SELECT_BY_ORDER, toInvoice } from "@/lib/invoices";
import { getStoreSettings } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Tax invoice · ${(await params).number}` };
}

/** The customer's tax invoice (and credit note, if refunded) for one of their orders. RLS limits it to their own. */
export default async function OrderInvoicePage({ params }: Params) {
  const { number } = await params;
  await requireUser(`/order/${number}/invoice`);
  const supabase = await createClient();
  const [{ data }, store] = await Promise.all([
    supabase.from("invoices").select(INVOICE_SELECT_BY_ORDER)
      .eq("order.order_number", number).order("issued_at"),
    getStoreSettings(),
  ]);
  if (!data?.length) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/order/${number}`} className="font-semibold text-brand-700">← Order {number}</Link>
        <PrintButton label="Print invoice" />
      </div>
      {data.map(toInvoice).map((inv) => <InvoiceDocument key={inv.id} invoice={inv} store={store} />)}
    </div>
  );
}
