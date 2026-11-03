import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReceiptActions } from "@/components/receipt-actions";
import { ReceiptDocument } from "@/components/receipt-document";
import { loadPublicReceipt } from "@/lib/receipt-data";
import { getStoreSettings } from "@/lib/store";

type Params = { params: Promise<{ token: string }> };

// Private receipt link sent to customers on WhatsApp: no sign-in needed, never indexed.
export const metadata: Metadata = { title: "Your receipt", robots: { index: false, follow: false } };

export default async function ReceiptLinkPage({ params }: Params) {
  const { token } = await params;
  const [receipt, store] = await Promise.all([loadPublicReceipt(token), getStoreSettings()]);
  if (!receipt) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="no-print">
        <h1 className="text-2xl font-bold">Your receipt</h1>
        <p className="text-ink-muted">Thank you for shopping with {store.name}. Download it as a PDF or print it below.</p>
      </div>
      <div className="rounded-3xl bg-surface p-6 print:bg-transparent print:p-0"><ReceiptDocument receipt={receipt} store={store} /></div>
      <ReceiptActions receipt={{ ...receipt, token: null }} store={store} />
    </div>
  );
}
