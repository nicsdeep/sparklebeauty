"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Shares the current page with the phone's share sheet, or copies the link on desktop. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* the customer closed the share sheet */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-surface">
      {copied ? <Check className="size-4 text-mint-fg" /> : <Share2 className="size-4 text-brand-600" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
