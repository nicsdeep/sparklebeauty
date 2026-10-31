import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoiceDocument } from "@/components/invoice-document";
import { requireUser } from "@/lib/auth";
import { loadOrderInvoices } from "@/lib/invoice-data";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Tax invoice · ${(await params).number}` };
}

/** The customer's tax invoice (and credit note, if refunded) for one of their orders. RLS limits it to their own. */
export default async function OrderInvoicePage({ params }: Params) {
  const { number } = await params;
  await requireUser(`/order/${number}/invoice`);
  const bundles = await loadOrderInvoices(number);
  if (!bundles.length) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/order/${number}`} className="font-semibold text-brand-700">← Order {number}</Link>
        <InvoiceActions bundles={bundles} />
      </div>
      {bundles.map((b) => <InvoiceDocument key={b.invoice.id} bundle={b} />)}
    </div>
  );
}
