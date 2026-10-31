import { loadOrderInvoices } from "@/lib/invoice-data";
import { invoicePdfResponse } from "@/lib/invoice-response";

/** The customer's invoice (and credit note) as a PDF. RLS limits it to their own orders. */
export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  return invoicePdfResponse(request, await loadOrderInvoices((await params).number));
}
