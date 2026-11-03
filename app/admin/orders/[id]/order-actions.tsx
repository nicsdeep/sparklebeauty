"use client";

import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { advanceOrder, cancelOrder, setDeliveryEstimate } from "../../actions";
import { NEXT_ACTION, type OrderStatus } from "@/lib/format";

// The estimate is entered and shown in Nairobi time (UTC+3, no daylight saving), whatever
// timezone the staff member's device is set to.
const EAT_MS = 3 * 60 * 60 * 1000;

/** ISO time → "YYYY-MM-DDTHH:mm" in Nairobi time, for the datetime-local input. */
function toNairobiInput(iso: string | null) {
  return iso ? new Date(new Date(iso).getTime() + EAT_MS).toISOString().slice(0, 16) : "";
}

/** "YYYY-MM-DDTHH:mm" in Nairobi time → ISO. */
const fromNairobiInput = (value: string) => new Date(`${value}:00+03:00`).toISOString();

export function OrderActions({ orderId, status, canCancel, delivery, eta }: {
  orderId: string; status: OrderStatus; canCancel: boolean;
  /** Delivered by rider (not collected at the shop). */
  delivery: boolean;
  /** Estimated delivery shown on the customer's tracking page. */
  eta: string | null;
}) {
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState(toNairobiInput(eta));
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();
  const label = NEXT_ACTION[status];
  // Set when dispatching, and can be corrected while the rider is out.
  const showEstimate = delivery && (status === "packed" || status === "dispatched");
  const estimateIso = estimate ? fromNairobiInput(estimate) : null;
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
        <Field label="Estimated delivery (Nairobi time)" hint="Shown to the customer on their tracking page.">
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
