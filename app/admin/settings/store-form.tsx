"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import type { StorePhone, StoreSettings } from "@/lib/store-types";
import { saveStoreSettings } from "../actions";

/** Shop details, phone numbers and delivery pricing. Saved to public.store_settings. */
export function StoreSettingsForm({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const [phones, setPhones] = useState<StorePhone[]>(settings.phones.length ? settings.phones : [{ label: "Shop", number: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await saveStoreSettings(form);
      setMsg(res.ok ? { ok: true, text: "Saved. The shop website now shows these details." } : { ok: false, text: res.error });
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <fieldset disabled={!canEdit || pending} className="space-y-6 disabled:opacity-80">
        <Card>
          <CardHeader title="Shop details" subtitle="Shown in the website footer, contact page, receipts and order tracking." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Shop name"><input name="name" defaultValue={settings.name} className={inputClass} required /></Field>
            <Field label="Opening hours"><input name="hours" defaultValue={settings.hours} className={inputClass} required /></Field>
            <Field label="Address"><input name="address" defaultValue={settings.address} className={inputClass} required /></Field>
            <Field label="Landmark"><input name="landmark" defaultValue={settings.landmark ?? ""} className={inputClass} /></Field>
            <Field label="WhatsApp number" hint="Used for the WhatsApp button on every page."><input name="whatsapp" defaultValue={settings.whatsapp ?? ""} className={inputClass} inputMode="tel" placeholder="+254 7xx xxx xxx" /></Field>
            <Field label="Email (optional)"><input name="email" type="email" defaultValue={settings.email ?? ""} className={inputClass} /></Field>
            <Field label="Google Maps embed" hint="Paste the link or the whole <iframe> from Google Maps → Share → Embed a map.">
              <input name="map_embed_url" defaultValue={settings.map_embed_url ?? ""} className={inputClass} />
            </Field>
            <Field label="Directions link"><input name="directions_url" defaultValue={settings.directions_url ?? ""} className={inputClass} /></Field>
            <Field label="Facebook page"><input name="facebook_url" defaultValue={settings.facebook_url ?? ""} className={inputClass} placeholder="https://www.facebook.com/…" /></Field>
            <Field label="Instagram"><input name="instagram_url" defaultValue={settings.instagram_url ?? ""} className={inputClass} placeholder="https://www.instagram.com/…" /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Phone numbers" subtitle="Each number gets a tap-to-call link. The first is the main number." />
          <div className="space-y-3 p-5">
            {phones.map((p, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="w-36"><Field label={i === 0 ? "Label" : ""}><input name="phone_label" value={p.label} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputClass} placeholder="Shop 1" aria-label={`Label for phone ${i + 1}`} /></Field></div>
                <div className="min-w-48 flex-1"><Field label={i === 0 ? "Number" : ""}><input name="phone_number" value={p.number} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))} className={inputClass} inputMode="tel" placeholder="07xx xxx xxx" aria-label={`Phone ${i + 1}`} /></Field></div>
                {canEdit && phones.length > 1 && (
                  <Button type="button" variant="ghost" className="border border-line" onClick={() => setPhones(phones.filter((_, j) => j !== i))} aria-label={`Remove phone ${i + 1}`}><Trash2 className="size-4" /></Button>
                )}
              </div>
            ))}
            {canEdit && <Button type="button" variant="secondary" size="sm" onClick={() => setPhones([...phones, { label: "", number: "" }])}><Plus className="size-4" /> Add Phone Number</Button>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Delivery pricing" subtitle="Used for the cart estimate and charged when an order is placed. Pickup is always free." />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Nairobi fee (KES)"><input name="delivery_fee_nairobi" defaultValue={settings.delivery_fee_nairobi} className={inputClass} inputMode="numeric" /></Field>
            <Field label="Rest of Kenya fee (KES)"><input name="delivery_fee_other" defaultValue={settings.delivery_fee_other} className={inputClass} inputMode="numeric" /></Field>
            <Field label="Free delivery over (KES)"><input name="free_delivery_threshold" defaultValue={settings.free_delivery_threshold} className={inputClass} inputMode="numeric" /></Field>
            <div className="sm:col-span-3">
              <Field label="Free delivery areas" hint="Comma-separated. Delivery is free when the customer's address or town contains one of these, e.g. CBD, Pipeline.">
                <input name="free_delivery_areas" defaultValue={settings.free_delivery_areas.join(", ")} className={inputClass} placeholder="CBD, Pipeline" />
              </Field>
            </div>
          </div>
        </Card>
      </fieldset>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={pending}>{pending ? "Saving…" : "Save Settings"}</Button>
          {msg && <p className={msg.ok ? "text-mint-fg" : "text-rose-fg"} role="status">{msg.text}</p>}
        </div>
      ) : (
        <p className="text-ink-muted">Only an admin can change these settings.</p>
      )}
    </form>
  );
}
