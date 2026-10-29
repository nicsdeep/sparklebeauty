"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { saveStaffUser, setUserActive } from "../actions";

export type StaffUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: "staff" | "admin" | "customer";
  active: boolean;
  last_sign_in_at: string | null;
};

/** Work users: add, edit role/phone/password, deactivate. Every action is checked in the database. */
export function StaffUsers({ users, currentUserId }: { users: StaffUser[]; currentUserId: string }) {
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await saveStaffUser(form);
      if (res.ok) {
        setMsg({ ok: true, text: "Saved. They can sign in with their email and password." });
        setEditing(null);
      } else setMsg({ ok: false, text: res.error });
    });
  }

  function toggle(u: StaffUser) {
    setMsg(null);
    start(async () => {
      const res = await setUserActive(u.id, !u.active);
      setMsg(res.ok ? { ok: true, text: `${u.full_name} ${u.active ? "deactivated" : "reactivated"}.` } : { ok: false, text: res.error });
    });
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <Card>
      <CardHeader title="Work users" subtitle="Staff can use the admin and POS; admins can also change settings and users."
        action={!editing && <Button size="sm" onClick={() => { setEditing("new"); setMsg(null); }}><UserPlus className="size-4" /> Add Work User</Button>} />
      {editing && (
        <form action={save} key={current?.id ?? "new"} className="grid gap-4 border-b border-line bg-surface p-5 sm:grid-cols-2">
          <p className="font-semibold sm:col-span-2">{current ? `Edit ${current.full_name}` : "New work user"}</p>
          <Field label="Full name"><input name="full_name" defaultValue={current?.full_name ?? ""} className={inputClass} required /></Field>
          <Field label="Email (used to sign in)"><input name="email" type="email" defaultValue={current?.email ?? ""} readOnly={!!current} className={inputClass} required /></Field>
          <Field label="Mobile number"><input name="phone" defaultValue={current?.phone ?? ""} className={inputClass} inputMode="tel" placeholder="07xx xxx xxx" /></Field>
          <Field label="Role">
            <select name="role" defaultValue={current?.role === "admin" ? "admin" : "staff"} className={inputClass}>
              <option value="staff">Staff (admin pages and POS)</option>
              <option value="admin">Admin (also settings and users)</option>
            </select>
          </Field>
          <Field label={current ? "New password (optional)" : "Temporary password"} hint="At least 8 characters. Share it privately with the person.">
            <input name="password" type="password" autoComplete="new-password" minLength={8} required={!current} className={inputClass} />
          </Field>
          <div className="flex items-end gap-2">
            <Button disabled={pending}>{pending ? "Saving…" : current ? "Save Changes" : "Create User"}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {msg && <p className={`px-5 pt-4 ${msg.ok ? "text-mint-fg" : "text-rose-fg"}`} role="status">{msg.text}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[15px]">
          <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
            <th className="px-5 py-3 font-medium">Name</th><th className="px-3 py-3 font-medium">Mobile</th><th className="px-3 py-3 font-medium">Role</th>
            <th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Last sign-in</th><th className="px-5 py-3 font-medium" /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3"><span className="font-semibold">{u.full_name}</span>{u.id === currentUserId && <span className="ml-2 text-xs text-ink-muted">(you)</span>}<span className="block text-sm text-ink-muted">{u.email}</span></td>
                <td className="whitespace-nowrap px-3 py-3">{u.phone ?? "-"}</td>
                <td className="px-3 py-3"><Badge tone={u.role === "admin" ? "brand" : "info"}>{u.role === "admin" ? "Admin" : "Staff"}</Badge></td>
                <td className="px-3 py-3">{u.active ? <Badge tone="mint">Active</Badge> : <Badge tone="rose">Deactivated</Badge>}</td>
                <td className="px-3 py-3 text-sm text-ink-muted">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Never"}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" className="border border-line" disabled={pending} onClick={() => { setEditing(u); setMsg(null); }}>Edit</Button>
                  {u.id !== currentUserId && (
                    <Button size="sm" variant={u.active ? "danger" : "secondary"} className="ml-2" disabled={pending} onClick={() => toggle(u)}>
                      {u.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
