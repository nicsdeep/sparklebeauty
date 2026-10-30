"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { createPromotion } from "../../actions";

/** New promo code. The server action validates it; checkout re-checks codes when an order is placed. */
export function PromotionForm({ today }: { today: string }) {
  const router = useRouter();
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="max-w-2xl">
      <form
        className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
        action={(form) => {
          setError(null);
          start(async () => {
            const res = await createPromotion(form);
            if (res.ok) router.push("/admin/promotions");
            else setError(res.error);
          });
        }}
      >
        <Field label="Name"><input name="name" required placeholder="e.g. December Glow Sale" className={inputClass} /></Field>
        <Field label="Code customers enter" hint="Letters and numbers only."><input name="code" required placeholder="GLOW15" className={`${inputClass} uppercase`} /></Field>
        <div className="sm:col-span-2">
          <Field label="Description (shown to customers)"><input name="description" placeholder="e.g. 15% off orders over KES 5,000" className={inputClass} /></Field>
        </div>
        <Field label="Discount type">
          <select name="discount_type" value={type} onChange={(e) => setType(e.target.value as "percentage" | "fixed")} className={inputClass}>
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off (KES)</option>
          </select>
        </Field>
        <Field label={type === "percentage" ? "Discount (%)" : "Discount (KES)"}>
          <input name="discount_value" type="number" required min={1} max={type === "percentage" ? 90 : undefined} step="any" className={inputClass} />
        </Field>
        <Field label="Minimum order (KES)"><input name="minimum_order_amount" type="number" min={0} step="any" defaultValue={0} className={inputClass} /></Field>
        <div />
        <Field label="Starts"><input name="starts_at" type="date" defaultValue={today} className={inputClass} /></Field>
        <Field label="Ends (optional)"><input name="ends_at" type="date" className={inputClass} /></Field>
        <label className="flex items-center gap-2.5 text-[15px] font-semibold sm:col-span-2">
          <input type="checkbox" name="is_active" defaultChecked className="size-5 accent-brand-600" /> Active
        </label>
        {error && <p className="text-sm text-rose-fg sm:col-span-2" role="alert">{error}</p>}
        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create Promotion"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
