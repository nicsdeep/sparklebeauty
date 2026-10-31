"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { InvoiceBundle } from "@/lib/invoices";

/**
 * View the invoice as a PDF in a new tab (print from there) or save it. The PDF is made in the
 * browser on click; the PDF library is loaded only then, so the page itself stays light.
 */
export function InvoiceActions({ bundles }: { bundles: InvoiceBundle[] }) {
  const [busy, setBusy] = useState<null | "view" | "download">(null);
  const [error, setError] = useState(false);

  async function make(kind: "view" | "download") {
    setBusy(kind); setError(false);
    // Open the tab now, while the click still counts, so pop-up blockers allow it.
    const tab = kind === "view" ? window.open("", "_blank") : null;
    try {
      const { invoicePdf } = await import("@/lib/invoice-pdf");
      const { blob, fileName } = await invoicePdf(bundles);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else {
        const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={!!busy} onClick={() => make("view")}>
        {busy === "view" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} View PDF
      </Button>
      <Button disabled={!!busy} onClick={() => make("download")}>
        {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
      </Button>
      {error && <p className="w-full text-sm text-rose-fg" role="alert">The PDF couldn't be made. Please try again.</p>}
    </div>
  );
}
