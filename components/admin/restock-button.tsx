"use client";

import { useState, useTransition } from "react";
import { Button, cx } from "@/components/ui";
import { adjustStock } from "@/app/admin/actions";

/** Receive or remove stock for one variant. Used on the inventory page and by AI restock suggestions. */
export function RestockButton({ variantId, suggested, label, tone = "brand" }: { variantId: string; suggested?: number; label?: string; tone?: "brand" | "ai" }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(suggested ?? 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(sign: 1 | -1) {
    start(async () => {
      const res = await adjustStock(variantId, sign * Number(qty), sign > 0 ? "Stock received" : "Stock count correction");
      setMsg(res.ok ? `Saved. ${res.data.quantity} on hand.` : res.error);
      if (res.ok) setOpen(false);
    });
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={() => { setOpen(true); setMsg(null); }}
          className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", tone === "ai" ? "border border-ai-line bg-white text-ai-fg hover:bg-ai-bg" : "border border-line bg-white hover:bg-surface")}>
          {label ?? "Adjust"}
        </button>
        {msg && <span className="text-sm text-mint-fg">{msg}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))} className="h-9 w-20 rounded-lg border border-line px-2 text-right" inputMode="numeric" aria-label="Quantity" autoFocus />
      <Button size="sm" disabled={pending || !Number(qty)} onClick={() => save(1)}>Receive +{qty || 0}</Button>
      {!suggested && <Button size="sm" variant="ghost" disabled={pending || !Number(qty)} onClick={() => save(-1)}>Remove</Button>}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {msg && <span className="text-sm text-rose-fg">{msg}</span>}
    </span>
  );
}
