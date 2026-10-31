import { loadInvoice } from "@/lib/invoice-data";
import { invoicePdfResponse } from "@/lib/invoice-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bundle = await loadInvoice((await params).id);
  return invoicePdfResponse(request, bundle ? [bundle] : []);
}
