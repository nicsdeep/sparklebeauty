"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button, inputClass } from "@/components/ui";
import { resetDemo } from "../actions";

/** Protected reset: needs the word RESET typed, then a second click. The database also checks for an admin. */
export function ResetDemo() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    start(async () => {
      const res = await resetDemo(form);
      setMsg(res.ok ? { ok: true, text: "Demo data has been reset to the starting state." } : { ok: false, text: res.error });
      if (res.ok) { setOpen(false); setConfirm(""); }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-ink-muted">
        Restores products, stock, customers, orders, payments, loyalty and reports to the seeded starting state, so the demo can be run again.
        Demo logins stay signed in.
      </p>
      {!open ? (
        <Button variant="danger" onClick={() => { setOpen(true); setMsg(null); }}><RotateCcw className="size-4" /> Reset Demo Data</Button>
      ) : (
        <form action={submit} className="space-y-3 rounded-xl bg-rose-bg p-4">
          <p className="text-sm font-semibold text-rose-fg">This deletes every order and change made since the last reset. Type RESET to confirm.</p>
          <input name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} placeholder="RESET" aria-label="Type RESET to confirm" autoComplete="off" />
          <div className="flex gap-2">
            <Button variant="danger" disabled={pending || confirm.trim().toUpperCase() !== "RESET"}>{pending ? "Resetting…" : "Reset Demo Data Now"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {msg && <p className={msg.ok ? "rounded-xl bg-mint-bg px-3 py-2 text-mint-fg" : "rounded-xl bg-rose-bg px-3 py-2 text-rose-fg"} role="status">{msg.text}</p>}
    </div>
  );
}
