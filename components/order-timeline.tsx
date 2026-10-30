import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { formatDateTime, ORDER_FLOW, STATUS_META, type OrderStatus } from "@/lib/format";

export type OrderEvent = { status: OrderStatus; note: string | null; created_at: string };

/**
 * Lifecycle tracker shared by the customer tracking page and the admin order page. Till sales
 * start out completed, so they (and cancelled orders) show a plain list of what happened.
 */
export function OrderTimeline({ status, events }: { status: OrderStatus; events: OrderEvent[] }) {
  if (status === "cancelled" || events[0]?.status === "completed") {
    return (
      <ol className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className={cx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", e.status === "cancelled" ? "bg-rose-bg text-rose-fg" : "bg-teal-bg text-teal-fg")}><Check className="size-3.5" /></span>
            <div><p className="font-semibold">{STATUS_META[e.status]?.label ?? e.status}</p>
              <p className="text-sm text-ink-muted">{formatDateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</p></div>
          </li>
        ))}
      </ol>
    );
  }
  const reached = ORDER_FLOW.indexOf(status);
  return (
    <ol className="relative space-y-0">
      {ORDER_FLOW.map((s, i) => {
        const stepEvents = events.filter((e) => e.status === s);
        const first = stepEvents[0];
        const done = i <= reached;
        const current = i === reached;
        return (
          <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
            {i < ORDER_FLOW.length - 1 && <span className={cx("absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5", i < reached ? "bg-brand-600" : "bg-line")} aria-hidden />}
            <span className={cx("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              done ? "bg-brand-600 text-white" : "border-2 border-line bg-white text-ink-muted", current && "ring-4 ring-brand-100")}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={cx("font-semibold", !done && "text-ink-muted")}>{STATUS_META[s].label}{current && <span className="ml-2 text-sm font-medium text-brand-700">Current</span>}</p>
              {first && <p className="text-sm text-ink-muted">{formatDateTime(first.created_at)}</p>}
              {events.filter((e) => e.status === s && e.note).map((e, j) => <p key={j} className="text-sm text-ink-muted">{e.note}</p>)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
