"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Printer, Share2 } from "lucide-react";
import { Button, cx, inputClass } from "@/components/ui";
import { receiptMessage, type ReceiptData } from "@/lib/receipt";
import { whatsappHref, type StoreSettings } from "@/lib/store-types";

/**
 * What can be done with a receipt, everywhere it is shown:
 *  - Print: prints the receipt PDF, 80 mm wide and exactly as long as the receipt.
 *  - Download PDF: saves it.
 *  - Share PDF: hands the PDF file itself to the phone/computer share menu (e.g. into a WhatsApp chat).
 *  - Send on WhatsApp: opens the customer's number with a private link to view and download the PDF
 *    (a WhatsApp link can carry text only, not a file).
 */
export function ReceiptActions({ receipt, store, phone = "", className }: { receipt: ReceiptData; store: StoreSettings; phone?: string; className?: string }) {
  const [busy, setBusy] = useState<null | "print" | "download" | "share">(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState(phone);
  const [canShare, setCanShare] = useState(false);
  const link = receipt.token ? `${typeof window === "undefined" ? "" : window.location.origin}/r/${receipt.token}` : null;

  useEffect(() => {
    // File sharing exists on most phones and on recent desktop browsers.
    const probe = new File([new Blob()], "probe.pdf", { type: "application/pdf" });
    setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, []);

  async function makePdf() {
    const { receiptPdf } = await import("@/lib/receipt-pdf");
    return receiptPdf(receipt, store);
  }

  async function run(kind: "print" | "download" | "share") {
    setBusy(kind); setError(null);
    try {
      const { blob, fileName } = await makePdf();
      const url = URL.createObjectURL(blob);
      if (kind === "download") {
        const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
        document.body.appendChild(a); a.click(); a.remove();
      } else if (kind === "share") {
        await navigator.share({ files: [new File([blob], fileName, { type: "application/pdf" })], title: `Receipt ${receipt.number}`, text: `${store.name} receipt ${receipt.number}` });
      } else {
        // Print the PDF itself (exact receipt size) from a hidden frame; the printer takes its paper size from the PDF.
        const frame = Object.assign(document.createElement("iframe"), { src: url });
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
        frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { window.open(url, "_blank"); } };
        document.body.appendChild(frame);
        setTimeout(() => frame.remove(), 120_000);
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("The receipt PDF couldn't be made. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const icon = (k: typeof busy, I: typeof Printer) => (busy === k ? <Loader2 className="size-4 animate-spin" /> : <I className="size-4" />);
  const validTo = to.replace(/\D/g, "").length >= 9;
  return (
    <div className={cx("no-print space-y-2", className)}>
      <div className={cx("grid gap-2", canShare ? "grid-cols-3" : "grid-cols-2")}>
        <Button variant="secondary" disabled={!!busy} onClick={() => run("print")}>{icon("print", Printer)} Print</Button>
        <Button variant="ghost" className="border border-line" disabled={!!busy} onClick={() => run("download")}>{icon("download", Download)} PDF</Button>
        {canShare && <Button variant="ghost" className="border border-line" disabled={!!busy} onClick={() => run("share")}>{icon("share", Share2)} Share PDF</Button>}
      </div>
      {link && (
        <div className="flex gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} className={cx(inputClass, "h-10")} placeholder="Customer WhatsApp number" inputMode="tel" aria-label="Customer WhatsApp number" />
          <a href={validTo ? whatsappHref(to, receiptMessage(receipt, store, link)) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!validTo}
            className={cx("inline-flex h-10 items-center whitespace-nowrap rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white", !validTo && "pointer-events-none opacity-40")}>
            Send on WhatsApp</a>
        </div>
      )}
      {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
    </div>
  );
}
