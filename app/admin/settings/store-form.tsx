"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, cx, inputClass } from "@/components/ui";
import type { StorePhone, StoreSettings } from "@/lib/store-types";
import { saveStoreSettings } from "../actions";

/** Shop details, phone numbers and delivery pricing. Saved to public.store_settings. */
export function StoreSettingsForm({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const [phones, setPhones] = useState<StorePhone[]>(settings.phones.length ? settings.phones : [{ label: "Shop", number: "" }]);
  const [whatsapp, setWhatsapp] = useState<StorePhone[]>(settings.whatsapp_contacts.length ? settings.whatsapp_contacts : [{ label: "Support", number: "" }]);
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
          <ContactList name="phone" items={phones} onChange={setPhones} canEdit={canEdit} placeholder="Shop 1" addLabel="Add Phone Number" />
        </Card>

        <Card>
          <CardHeader title="WhatsApp contacts" subtitle="Customers choose who to message from the WhatsApp button. The first is the main contact, shown on invoices and the contact page." />
          <ContactList name="wa" items={whatsapp} onChange={setWhatsapp} canEdit={canEdit} placeholder="Support, Sales, Admin…" addLabel="Add WhatsApp Contact" max={8} />
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

        <Card>
          <CardHeader title="Tax and KRA" subtitle="Printed on every tax invoice. Prices are VAT-exclusive: VAT is added on top at the till and checkout." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Shop KRA PIN" hint="11 characters, e.g. P051234567X."><input name="kra_pin" defaultValue={settings.kra_pin ?? ""} className={cx(inputClass, "uppercase")} maxLength={11} placeholder="P051234567X" /></Field>
            <label className="flex items-start gap-3 self-end rounded-xl border border-line p-3">
              <input type="checkbox" name="vat_registered" defaultChecked={settings.vat_registered} className="mt-1 size-4 accent-brand-600" />
              <span><span className="block font-semibold">VAT registered</span><span className="text-sm text-ink-muted">Adds VAT by each product&apos;s tax type (16% standard). Untick if the shop is not registered for VAT.</span></span>
            </label>
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

/** Editable list of labelled numbers (phone numbers, WhatsApp contacts). Posts `<name>_label` and `<name>_number`. */
function ContactList({ name, items, onChange, canEdit, placeholder, addLabel, max = 10 }: {
  name: string; items: StorePhone[]; onChange: (items: StorePhone[]) => void; canEdit: boolean; placeholder: string; addLabel: string; max?: number;
}) {
  const set = (i: number, patch: Partial<StorePhone>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3 p-5">
      {items.map((p, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3">
          <div className="w-44"><Field label={i === 0 ? "Label" : ""}><input name={`${name}_label`} value={p.label} onChange={(e) => set(i, { label: e.target.value })} className={inputClass} placeholder={placeholder} aria-label={`Label ${i + 1}`} /></Field></div>
          <div className="min-w-48 flex-1"><Field label={i === 0 ? "Number" : ""}><input name={`${name}_number`} value={p.number} onChange={(e) => set(i, { number: e.target.value })} className={inputClass} inputMode="tel" placeholder="07xx xxx xxx" aria-label={`Number ${i + 1}`} /></Field></div>
          {canEdit && items.length > 1 && (
            <Button type="button" variant="ghost" className="border border-line" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${i + 1}`}><Trash2 className="size-4" /></Button>
          )}
        </div>
      ))}
      {canEdit && items.length < max && <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, { label: "", number: "" }])}><Plus className="size-4" /> {addLabel}</Button>}
    </div>
  );
}
