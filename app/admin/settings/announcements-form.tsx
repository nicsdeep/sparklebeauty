"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import { ANNOUNCEMENT_ICONS, type Announcement } from "@/lib/announcement-types";
import { saveAnnouncements, type AnnouncementInput } from "../actions";

const ICON_LABEL: Record<string, string> = {
  truck: "Delivery truck", "badge-check": "Original / verified", sparkles: "Sparkles", "map-pin": "Location",
  package: "Package / tracking", shield: "Shield", gift: "Gift", heart: "Heart",
};

/** The rotating announcement bar at the top of the shop: one row per message, shown in this order. */
export function AnnouncementsForm({ items }: { items: Announcement[] }) {
  const [rows, setRows] = useState<AnnouncementInput[]>(() => items.filter((a) => !a.id.startsWith("fallback-")).map((a) => (
    { id: a.id, text: a.text, mobile_text: a.mobile_text ?? "", icon: a.icon, href: a.href ?? "", is_active: a.is_active })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const edit = (i: number, patch: Partial<AnnouncementInput>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const next = [...rs]; [next[i], next[i + d]] = [next[i + d], next[i]]; return next; });

  return (
    <Card>
      <CardHeader title="Announcement bar"
        subtitle="Short messages that rotate at the top of the shop, one at a time. Put *stars* around a phrase to highlight it; {free_threshold} shows the free-delivery amount." />
      <div className="space-y-4 p-5">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Message {i + 1}</p>
              <div className="flex items-center gap-1">
                <label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={r.is_active} onChange={(e) => edit(i, { is_active: e.target.checked })} className="size-4 accent-brand-600" /> Show</label>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 hover:bg-surface disabled:opacity-30" aria-label={`Move message ${i + 1} up`}><ArrowUp className="size-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded-lg p-2 hover:bg-surface disabled:opacity-30" aria-label={`Move message ${i + 1} down`}><ArrowDown className="size-4" /></button>
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-rose-fg hover:bg-rose-bg" aria-label={`Remove message ${i + 1}`}><Trash2 className="size-4" /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Text (desktop)"><input value={r.text} onChange={(e) => edit(i, { text: e.target.value })} maxLength={120} className={inputClass} required /></Field>
              <Field label="Shorter text for phones" hint="Optional. Keep it to about 30 characters so it fits on one line.">
                <input value={r.mobile_text} onChange={(e) => edit(i, { mobile_text: e.target.value })} maxLength={60} className={inputClass} />
              </Field>
              <Field label="Icon">
                <select value={r.icon} onChange={(e) => edit(i, { icon: e.target.value })} className={inputClass}>
                  {ANNOUNCEMENT_ICONS.map((k) => <option key={k} value={k}>{ICON_LABEL[k]}</option>)}
                </select>
              </Field>
              <Field label="Link (optional)" hint="A site path like /delivery, or an https:// link."><input value={r.href} onChange={(e) => edit(i, { href: e.target.value })} className={inputClass} /></Field>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-ink-muted">No messages: the bar is hidden.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" disabled={rows.length >= 8}
            onClick={() => setRows((rs) => [...rs, { id: null, text: "", mobile_text: "", icon: "sparkles", href: "", is_active: true }])}>
            <Plus className="size-4" /> Add Message
          </Button>
          <Button disabled={pending} onClick={() => { setMsg(null); start(async () => {
            const res = await saveAnnouncements(rows);
            if (res.ok) setRows((rs) => rs.map((row, j) => ({ ...row, id: res.data.ids[j] ?? row.id })));
            setMsg(res.ok ? { ok: true, text: "Saved. The announcement bar is updated." } : { ok: false, text: res.error });
          }); }}>{pending ? "Saving…" : "Save Announcements"}</Button>
          {msg && <p className={msg.ok ? "text-mint-fg" : "text-rose-fg"} role="status">{msg.text}</p>}
        </div>
      </div>
    </Card>
  );
}
