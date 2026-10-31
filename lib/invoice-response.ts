import type { InvoiceBundle } from "@/lib/invoice-data";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/** PDF response: shown in the browser, or saved as a file with ?download=1. */
export async function invoicePdfResponse(request: Request, bundles: InvoiceBundle[]) {
  if (!bundles.length) return new Response("Invoice not found", { status: 404 });
  const url = new URL(request.url);
  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdf(bundles);
  } catch (e) {
    console.error("Invoice PDF failed", bundles.map((b) => b.invoice.invoice_number), e);
    return new Response("The invoice PDF could not be created. Please try again, or use the invoice page.", { status: 500 });
  }
  const name = `${bundles.map((b) => b.invoice.invoice_number).join("_")}_Sparkle.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
