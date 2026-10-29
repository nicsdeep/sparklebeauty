"use client";

import { useState, useTransition } from "react";
import { Button, inputClass } from "@/components/ui";
import { advanceOrder, cancelOrder } from "../../actions";
import { NEXT_ACTION, type OrderStatus } from "@/lib/format";

export function OrderActions({ orderId, status, canCancel }: { orderId: string; status: OrderStatus; canCancel: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();
  const label = NEXT_ACTION[status];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else { setNote(""); setConfirmCancel(false); }
    });

  if (!label && !canCancel) return <p className="text-ink-muted">No further actions. This order is {status === "completed" ? "complete" : status}.</p>;

  return (
    <div className="space-y-3">
      {label && (
        <>
          <input className={inputClass} placeholder="Note (optional), e.g. rider name" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <Button size="lg" className="w-full" disabled={pending} onClick={() => run(() => advanceOrder(orderId, note))}>
            {pending ? "Updating…" : label}
          </Button>
        </>
      )}
      {canCancel && !confirmCancel && <Button variant="danger" className="w-full" disabled={pending} onClick={() => setConfirmCancel(true)}>Cancel Order</Button>}
      {confirmCancel && (
        <div className="space-y-2 rounded-xl bg-rose-bg p-3">
          <p className="text-sm text-rose-fg">Cancel this order? Reserved stock goes back on sale{status === "pending" ? "" : " and any payment is marked refunded"}.</p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => cancelOrder(orderId, note || "Cancelled by staff"))}>Yes, Cancel Order</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>Keep Order</Button>
          </div>
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-bg px-3 py-2 text-sm text-rose-fg" role="alert">{error}</p>}
    </div>
  );
}
