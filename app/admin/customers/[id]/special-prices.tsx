"use client";

import { useState, useTransition } from "react";
import { Tag, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import { kes } from "@/lib/format";
import { removeCustomerPrice, setCustomerPrice } from "../../actions";

export type SpecialPrice = { variantId: string; sku: string; name: string; amount: number; retail: number };

/**
 * Negotiated prices for one customer. The pricing engine applies them before every other rule
 * (wholesale tier, 10+ units, retail) on the website, at checkout and at the till.
 */
export function SpecialPrices({ customerId, prices }: { customerId: string; prices: SpecialPrice[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader title="Special prices" subtitle="Negotiated prices beat every other rule for this customer."
        action={!open && <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setError(null); }}><Tag className="size-4" /> Add</Button>} />
      {open && (
        <form className="grid gap-3 border-b border-line p-5"
          action={(form) => start(async () => {
            const res = await setCustomerPrice(customerId, form);
            if (res.ok) setOpen(false); else setError(res.error);
          })}>
          <Field label="Product code (SKU)"><input name="sku" required className={inputClass} placeholder="e.g. DARLINGSUP-1" autoComplete="off" /></Field>
          <Field label="Price (KES)"><input name="amount" type="number" min={1} step="any" required className={inputClass} /></Field>
          <Field label="Note (optional)"><input name="note" className={inputClass} placeholder="e.g. Agreed for monthly bulk orders" /></Field>
          {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
          <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save price"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      )}
      <ul className="divide-y divide-line">
        {prices.map((p) => (
          <li key={p.variantId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[15px]">
            <span className="min-w-0"><span className="block truncate">{p.name}</span><span className="text-xs text-ink-muted">{p.sku} · retail {kes(p.retail)}</span></span>
            <span className="flex items-center gap-2"><strong>{kes(p.amount)}</strong>
              <button onClick={() => start(async () => { await removeCustomerPrice(customerId, p.variantId); })} aria-label={`Remove special price for ${p.name}`} className="p-1 text-ink-muted hover:text-rose-fg"><Trash2 className="size-4" /></button></span>
          </li>
        ))}
        {!prices.length && !open && <li className="px-5 py-3 text-sm text-ink-muted">None. Standard pricing applies.</li>}
      </ul>
    </Card>
  );
}
