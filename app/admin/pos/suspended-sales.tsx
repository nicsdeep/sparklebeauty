"use client";

import { useState } from "react";
import { Clock, Phone, Play, TimerReset, Undo2 } from "lucide-react";
import { Button, cx, inputClass } from "@/components/ui";
import { kes } from "@/lib/format";
import { fromNairobiInput, nairobiShort, toNairobiInput } from "@/lib/nairobi-time";
import { orderTax } from "@/lib/tax";
import type { PosSuspension } from "../actions";
import type { PosItem } from "./terminal";

const EXTEND_BY = [["+30 min", 30], ["+1 h", 60], ["+2 h", 120], ["+6 h", 360], ["+12 h", 720], ["+24 h", 1440]] as const;
const MAX_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/** "23h 14m left" */
function left(ms: number) {
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m left` : `${m}m left`;
}

/** Suspended sales list: Resume, Extend (new expiry shown before saving) and Release. */
export function SuspendedSales({ list, now, itemsBy, resumedId, onResume, onRelease, onExtend }: {
  list: PosSuspension[]; now: Date; itemsBy: Map<string, PosItem>; resumedId: string | null;
  onResume: (s: PosSuspension) => void; onRelease: (s: PosSuspension) => void; onExtend: (s: PosSuspension, until: string) => Promise<boolean>;
}) {
  const [extending, setExtending] = useState<string | null>(null);
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);

  if (!list.length) return <p className="py-6 text-center text-ink-muted">No suspended sales. Use Suspend (F6) to put a sale aside.</p>;

  return (
    <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
      {list.map((s) => {
        const ms = new Date(s.expiresAt).getTime() - now.getTime();
        const tone = ms < 60 * 60 * 1000 ? "bg-rose-bg text-rose-fg" : ms < 6 * 60 * 60 * 1000 ? "bg-amber-bg text-amber-fg" : "bg-surface text-ink-muted";
        const units = s.items.reduce((n, i) => n + i.quantity, 0);
        const sub = s.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
        const total = orderTax(s.items.map((i) => ({ amount: i.unitPrice * i.quantity, rate: itemsBy.get(i.variantId)?.taxRate ?? 0 })),
          Math.round((sub * s.discountPct) / 100)).total;
        const open = extending === s.id;
        const untilIso = until ? fromNairobiInput(until) : null;
        const untilOk = !!untilIso && new Date(untilIso).getTime() > now.getTime() && new Date(untilIso).getTime() <= now.getTime() + MAX_AHEAD_MS;
        return (
          <li key={s.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-ink-muted">{s.reference}{resumedId === s.id && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">In cart</span>}</p>
                <p className="font-semibold">{s.customerName ?? "Walk-in Customer"}</p>
                {s.customerPhone && <p className="flex items-center gap-1 text-sm text-ink-muted"><Phone className="size-3.5" />{s.customerPhone}</p>}
                <p className="text-sm text-ink-muted">{units} item{units === 1 ? "" : "s"} · {kes(total)}</p>
                {s.notes && <p className="mt-0.5 text-sm italic text-ink-muted">“{s.notes}”</p>}
              </div>
              <span className={cx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tone)}><Clock className="size-3.5" />{left(ms)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onResume(s)} disabled={resumedId === s.id}><Play className="size-4" /> Resume</Button>
              <Button size="sm" variant="secondary" onClick={() => { setExtending(open ? null : s.id); setUntil(""); }}><TimerReset className="size-4" /> Extend</Button>
              <Button size="sm" variant="ghost" onClick={() => onRelease(s)}><Undo2 className="size-4" /> Release</Button>
            </div>
            {open && (
              <div className="mt-3 space-y-2 rounded-xl bg-surface p-3">
                <p className="text-xs text-ink-muted">Expires {nairobiShort(s.expiresAt)}. Extend by:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXTEND_BY.map(([label, min]) => (
                    <button key={label} onClick={() => setUntil(toNairobiInput(new Date(Math.max(new Date(s.expiresAt).getTime(), now.getTime()) + min * 60000).toISOString()))}
                      className="rounded-full border border-line bg-white px-3 py-1 text-sm font-semibold hover:border-brand-200">{label}</button>
                  ))}
                </div>
                <label className="block text-xs text-ink-muted">Or a date and time (Nairobi)
                  <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={cx(inputClass, "mt-1 h-10")} /></label>
                {untilIso && (
                  <p className={cx("text-sm", untilOk ? "text-ink" : "text-rose-fg")}>
                    {untilOk ? <>New expiry: <strong>{nairobiShort(untilIso)}</strong></> : "Choose a time in the future, within 7 days."}
                  </p>
                )}
                <Button size="sm" className="w-full" disabled={!untilOk || saving}
                  onClick={async () => { setSaving(true); if (await onExtend(s, untilIso!)) setExtending(null); setSaving(false); }}>
                  {saving ? "Saving…" : "Confirm New Expiry"}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
