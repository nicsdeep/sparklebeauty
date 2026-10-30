"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Field, cx, inputClass } from "@/components/ui";
import { createCustomer } from "../../actions";

/** New customer: walk-in, phone or salon (wholesale). admin_create_customer() validates everything. */
export function CustomerForm() {
  const router = useRouter();
  const [type, setType] = useState<"retail" | "wholesale">("retail");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="max-w-2xl">
      <form
        className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
        action={(form) => {
          setError(null);
          start(async () => {
            const res = await createCustomer(form);
            if (res.ok) router.push(`/admin/customers/${res.data.id}`);
            else setError(res.error);
          });
        }}
      >
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Customer type</legend>
          <div className="flex gap-2">
            {(["retail", "wholesale"] as const).map((t) => (
              <label key={t} className={cx("flex-1 cursor-pointer rounded-xl border px-4 py-3 text-[15px] font-semibold transition",
                type === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line hover:border-brand-200")}>
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {t === "retail" ? "Retail" : "Wholesale (salon or reseller)"}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name"><input name="full_name" required className={inputClass} autoComplete="off" /></Field>
        <Field label="Mobile number"><input name="phone" required inputMode="tel" placeholder="07xx xxx xxx" className={inputClass} autoComplete="off" /></Field>
        <div className="sm:col-span-2">
          <Field label="Email (optional)" hint="Customers added here can't sign in online yet; they shop in store, by phone or WhatsApp.">
            <input name="email" type="email" className={inputClass} autoComplete="off" />
          </Field>
        </div>
        {type === "wholesale" && (
          <>
            <Field label="Business name"><input name="business_name" required className={inputClass} /></Field>
            <Field label="Business location"><input name="business_location" placeholder="e.g. Thika Road" className={inputClass} /></Field>
            <p className="text-sm text-ink-muted sm:col-span-2">Wholesale customers get wholesale prices at the POS.</p>
          </>
        )}
        {error && <p className="text-sm text-rose-fg sm:col-span-2" role="alert">{error}</p>}
        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add Customer"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
