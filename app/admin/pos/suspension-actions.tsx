"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Clock, Play, TimerReset, Undo2, X } from "lucide-react";
import { Button, buttonClass, cx, inputClass } from "@/components/ui";
import { fromNairobiInput, nairobiShort, toNairobiInput } from "@/lib/nairobi-time";
import { extendSuspension, releaseSuspension } from "../actions";

// Suspended-sale actions shared by the Suspended Sales list and detail pages. Lists and details
// are pages; only these short confirmations open as small dialogs.

const EXTEND_BY = [["+30 min", 30], ["+1 h", 60], ["+2 h", 120], ["+6 h", 360], ["+12 h", 720], ["+24 h", 1440]] as const;
const MAX_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

function useNow(everyMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}

/** "23h 14m left": grey, amber under 6 hours, red under 1 hour. Refreshes the page when it runs out. */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const now = useNow();
  const ms = new Date(expiresAt).getTime() - now;
  useEffect(() => { if (ms <= 0) router.refresh(); }, [ms <= 0, router]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.max(0, Math.floor(ms / 60000));
  const text = ms <= 0 ? "Expiring…" : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m left` : `${m}m left`;
  const tone = ms < 60 * 60 * 1000 ? "bg-rose-bg text-rose-fg" : ms < 6 * 60 * 60 * 1000 ? "bg-amber-bg text-amber-fg" : "bg-surface text-ink-muted";
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}><Clock className="size-3.5" />{text}</span>;
}

function SmallDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-24" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1"><X className="size-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Resume, Extend and Release for an active suspended sale. */
export function SuspensionActions({ id, reference, expiresAt, compact }: { id: string; reference: string; expiresAt: string; compact?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const [dialog, setDialog] = useState<null | "extend" | "release">(null);
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const untilIso = until ? fromNairobiInput(until) : null;
  const untilOk = !!untilIso && new Date(untilIso).getTime() > now && new Date(untilIso).getTime() <= now + MAX_AHEAD_MS;
  const close = () => { setDialog(null); setUntil(""); setError(null); };

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    close(); router.refresh();
  }

  const size = compact ? "sm" : "md";
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/pos?resume=${id}`} className={buttonClass({ size })}><Play className="size-4" /> Resume</Link>
      <Button size={size} variant="secondary" onClick={() => setDialog("extend")}><TimerReset className="size-4" /> Extend</Button>
      <Button size={size} variant="ghost" className="border border-line" onClick={() => setDialog("release")}><Undo2 className="size-4" /> Release</Button>

      {dialog === "extend" && (
        <SmallDialog title={`Extend ${reference}`} onClose={close}>
          <p className="text-sm text-ink-muted">Expires {nairobiShort(expiresAt)}. Extend by:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXTEND_BY.map(([label, min]) => (
              <button key={label} onClick={() => setUntil(toNairobiInput(new Date(Math.max(new Date(expiresAt).getTime(), now) + min * 60000).toISOString()))}
                className="rounded-full border border-line bg-white px-3 py-1 text-sm font-semibold hover:border-ink/30">{label}</button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-ink-muted">Or a date and time (Nairobi)
            <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={cx(inputClass, "mt-1 h-10")} /></label>
          {untilIso && <p className={cx("mt-2 text-sm", untilOk ? "text-ink" : "text-rose-fg")}>
            {untilOk ? <>New expiry: <strong>{nairobiShort(untilIso)}</strong></> : "Choose a time in the future, within 7 days."}</p>}
          {error && <p className="mt-2 text-sm text-rose-fg" role="alert">{error}</p>}
          <Button className="mt-4 w-full" disabled={!untilOk || busy} onClick={() => run(() => extendSuspension(id, untilIso!))}>{busy ? "Saving…" : "Confirm New Expiry"}</Button>
        </SmallDialog>
      )}
      {dialog === "release" && (
        <SmallDialog title={`Release ${reference}?`} onClose={close}>
          <p className="text-sm text-ink-muted">The sale is cancelled and its items go back on sale on the website and every till.</p>
          {error && <p className="mt-2 text-sm text-rose-fg" role="alert">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => run(() => releaseSuspension(id))}>{busy ? "Releasing…" : "Yes, Release"}</Button>
            <Button variant="ghost" onClick={close}>Keep It</Button>
          </div>
        </SmallDialog>
      )}
    </div>
  );
}
