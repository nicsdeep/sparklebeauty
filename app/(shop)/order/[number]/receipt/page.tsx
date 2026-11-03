import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReceiptActions } from "@/components/receipt-actions";
import { ReceiptDocument } from "@/components/receipt-document";
import { requireUser } from "@/lib/auth";
import { loadReceipt } from "@/lib/receipt-data";
import { getStoreSettings } from "@/lib/store";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Receipt · ${(await params).number}` };
}

/** The customer's receipt for one of their paid orders. RLS limits it to their own. */
export default async function CustomerReceiptPage({ params }: Params) {
  const { number } = await params;
  await requireUser(`/order/${number}/receipt`);
  const [receipt, store] = await Promise.all([loadReceipt({ number }), getStoreSettings()]);
  if (!receipt || !receipt.payments.length) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/order/${number}`} className="font-semibold text-brand-700">← Order {number}</Link>
      </div>
      <div className="rounded-3xl bg-surface p-6 print:bg-transparent print:p-0"><ReceiptDocument receipt={receipt} store={store} /></div>
      <ReceiptActions receipt={receipt} store={store} />
    </div>
  );
}
