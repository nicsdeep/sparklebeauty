import { Download, FileText } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Open the invoice PDF in a new tab (view or print from there) or save it. */
export function InvoiceActions({ pdfHref }: { pdfHref: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={pdfHref} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary" })}><FileText className="size-4" /> View PDF</a>
      <a href={`${pdfHref}?download=1`} className={buttonClass()}><Download className="size-4" /> Download PDF</a>
    </div>
  );
}
