"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import { setCustomerLogin } from "../../actions";

/** Staff give a customer online access, or reset a forgotten password (there's no email reset yet). */
export function OnlineAccess({ customerId, email, firstName }: { customerId: string; email: string | null; firstName: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader title="Online access"
        subtitle={email ? `Signs in with ${email}.` : "No email yet, so they can't sign in to the website."}
        action={!open && <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setMsg(null); }}><KeyRound className="size-4" /> {email ? "Reset password" : "Set up sign-in"}</Button>} />
      {open && (
        <form className="space-y-4 p-5"
          action={(form) => start(async () => {
            const res = await setCustomerLogin(customerId, form);
            if (res.ok) { setOpen(false); setMsg({ ok: true, text: `Done. Share the temporary password with ${firstName} privately (not by group chat); they can change it in My Account.` }); }
            else setMsg({ ok: false, text: res.error });
          })}>
          <Field label="Email (they sign in with this)"><input name="email" type="email" required defaultValue={email ?? ""} className={inputClass} autoComplete="off" /></Field>
          <Field label="Temporary password" hint="At least 8 characters.">
            <input name="password" type="text" required minLength={8} className={inputClass} autoComplete="new-password" spellCheck={false} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {msg && <p className={`mx-5 mb-5 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-mint-bg text-mint-fg" : "bg-rose-bg text-rose-fg"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </Card>
  );
}
