import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptActions } from "@/components/receipt-actions";
import { ReceiptDocument } from "@/components/receipt-document";
import { loadReceipt } from "@/lib/receipt-data";
import { getStoreSettings } from "@/lib/store";

export const metadata = { title: "Receipt" };

export default async function OrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [receipt, store] = await Promise.all([loadReceipt({ id }), getStoreSettings()]);
  if (!receipt) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/admin/orders/${id}`} className="font-semibold text-brand-700">← Order {receipt.number}</Link>
      </div>
      <div className="rounded-3xl bg-surface p-6 print:bg-transparent print:p-0"><ReceiptDocument receipt={receipt} store={store} /></div>
      <ReceiptActions receipt={receipt} store={store} />
    </div>
  );
}
