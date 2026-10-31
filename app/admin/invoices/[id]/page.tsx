import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoiceDocument } from "@/components/invoice-document";
import { loadInvoice } from "@/lib/invoice-data";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await loadInvoice(id);
  if (!bundle) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/invoices" className="font-semibold text-brand-700">← All invoices</Link>
        <InvoiceActions bundles={[bundle]} />
      </div>
      <InvoiceDocument bundle={bundle} />
    </div>
  );
}
