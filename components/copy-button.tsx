"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/components/ui";

/** Copies `text` (e.g. an M-Pesa reference) and shows a tick for a moment. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      // Clipboard API blocked (older browsers, some in-app browsers): copy through a hidden field.
      const t = document.createElement("textarea");
      t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      ok = document.execCommand("copy");
      t.remove();
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <button type="button" onClick={copy} aria-label={label} title={copied ? "Copied" : "Copy"}
      className={cx("rounded-md p-1 text-[#E6007E] transition hover:bg-[#FDF2F8]", className)}>
      {copied ? <Check className="size-[18px]" /> : <Copy className="size-[18px]" />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}
