import type { InvoiceBundle } from "@/lib/invoice-data";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/** PDF response: shown in the browser, or saved as a file with ?download=1. */
export async function invoicePdfResponse(request: Request, bundles: InvoiceBundle[]) {
  if (!bundles.length) return new Response("Invoice not found", { status: 404 });
  const url = new URL(request.url);
  const pdf = await renderInvoicePdf(bundles, url.origin);
  const name = `${bundles.map((b) => b.invoice.invoice_number).join("_")}_Sparkle.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
