"use client";

import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { advanceOrder, cancelOrder, setDeliveryEstimate } from "../../actions";
import { NEXT_ACTION, type OrderStatus } from "@/lib/format";

/** ISO time → the value a datetime-local input shows (this browser's local time). */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function OrderActions({ orderId, status, canCancel, delivery, eta }: {
  orderId: string; status: OrderStatus; canCancel: boolean;
  /** Delivered by rider (not collected at the shop). */
  delivery: boolean;
  /** Estimated delivery shown on the customer's tracking page. */
  eta: string | null;
}) {
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState(toLocalInput(eta));
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();
  const label = NEXT_ACTION[status];
  // Set when dispatching, and can be corrected while the rider is out.
  const showEstimate = delivery && (status === "packed" || status === "dispatched");
  const estimateIso = estimate ? new Date(estimate).toISOString() : null;
  const estimateChanged = estimateIso !== (eta ? new Date(eta).toISOString() : null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else { setNote(""); setConfirmCancel(false); }
    });

  const advance = async () => {
    if (showEstimate && estimateChanged) {
      const res = await setDeliveryEstimate(orderId, estimateIso);
      if (!res.ok) return res;
    }
    return advanceOrder(orderId, note);
  };

  if (!label && !canCancel) return <p className="text-ink-muted">No further actions. This order is {status === "completed" ? "complete" : status}.</p>;

  return (
    <div className="space-y-3">
      {showEstimate && (
        <Field label="Estimated delivery" hint="Shown to the customer on their tracking page.">
          <div className="flex gap-2">
            <input type="datetime-local" className={inputClass} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
            {status === "dispatched" && (
              <Button variant="secondary" disabled={pending || !estimateChanged} onClick={() => run(() => setDeliveryEstimate(orderId, estimateIso))}>Save</Button>
            )}
          </div>
        </Field>
      )}
      {label && (
        <>
          <input className={inputClass} placeholder="Note (optional), e.g. rider name" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <Button size="lg" className="w-full" disabled={pending} onClick={() => run(advance)}>
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
