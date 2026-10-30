"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, cx, inputClass } from "@/components/ui";
import { setCustomerKraPin } from "../../actions";

/** The customer's KRA PIN, printed on their tax invoices (business buyers need it to claim VAT). */
export function KraPin({ customerId, pin }: { customerId: string; pin: string | null }) {
  const [value, setValue] = useState(pin ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="KRA PIN" subtitle="Printed on this customer's tax invoices. Optional for walk-in buyers." />
      <form className="flex flex-wrap gap-2 p-5"
        action={() => start(async () => {
          const res = await setCustomerKraPin(customerId, value);
          setMsg(res.ok ? { ok: true, text: value ? "Saved." : "Removed." } : { ok: false, text: res.error });
        })}>
        <input value={value} onChange={(e) => { setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11)); setMsg(null); }}
          className={cx(inputClass, "w-44 font-mono uppercase")} placeholder="A012345678Z" aria-label="Customer KRA PIN" />
        <Button type="submit" variant="secondary" disabled={pending || value === (pin ?? "")}>{pending ? "Saving…" : "Save"}</Button>
        {msg && <p className={cx("w-full text-sm", msg.ok ? "text-mint-fg" : "text-rose-fg")} role="status">{msg.text}</p>}
      </form>
    </Card>
  );
}
