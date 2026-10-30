"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import { changePassword } from "../actions";

/** Lets a customer replace the temporary password staff gave them, or any old password. */
export function ChangePassword() {
  const form = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Change password" subtitle="Got a temporary password from the shop? Replace it here." />
      <form ref={form} className="space-y-4 p-5"
        action={(data) => start(async () => {
          const res = await changePassword(data);
          setMsg(res.ok ? { ok: true, text: "Password changed. Use it next time you sign in." } : { ok: false, text: res.error });
          if (res.ok) form.current?.reset();
        })}>
        <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className={inputClass} /></Field>
        <Field label="New password" hint="At least 8 characters."><input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
        <Field label="Confirm new password"><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-mint-bg text-mint-fg" : "bg-rose-bg text-rose-fg"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Change Password"}</Button>
      </form>
    </Card>
  );
}
