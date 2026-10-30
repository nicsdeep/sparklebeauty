"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, inputClass } from "@/components/ui";
import type { HeroBanner } from "@/lib/hero";
import { saveHeroBanner } from "../actions";

const FOCUS = [
  { value: "25% center", label: "Left of the artwork" },
  { value: "50% center", label: "Centre" },
  { value: "72% center", label: "Right of centre (model)" },
  { value: "90% center", label: "Far right" },
];

/** Homepage hero: the background artwork and the text shown over it are edited separately. */
export function HeroForm({ banner }: { banner: HeroBanner }) {
  const [image, setImage] = useState(banner.image_url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await saveHeroBanner(form);
      setMsg(res.ok ? { ok: true, text: "Saved. The homepage banner is updated." } : { ok: false, text: res.error });
    });
  }

  return (
    <Card>
      <CardHeader title="Homepage banner" subtitle="The background artwork should be image only, with no text or logo in it. The text below is shown on top." />
      <form action={submit} className="grid gap-4 p-5 lg:grid-cols-2">
        {banner.id && <input type="hidden" name="id" value={banner.id} />}
        <div className="space-y-4">
          <Field label="Background image" hint="A site path like /brand/hero-banner.jpg, or an https:// link. Wide artwork (about 2048×768) with space on the left works best.">
            <input name="image_url" value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} required />
          </Field>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" className="aspect-[8/3] w-full rounded-xl border border-line object-cover" />}
          <Field label="Image description (for screen readers)"><input name="image_alt" defaultValue={banner.image_alt} className={inputClass} /></Field>
          <Field label="On phones, keep this part in view">
            <select name="image_focus" defaultValue={banner.image_focus} className={inputClass}>
              {FOCUS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="show_logo" defaultChecked={banner.show_logo} className="size-4 accent-brand-600" /> Show the Sparkle logo in the banner (desktop)</label>
        </div>
        <div className="space-y-4">
          <Field label="Small heading above"><input name="eyebrow" defaultValue={banner.eyebrow ?? ""} className={inputClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Heading"><input name="title" defaultValue={banner.title} className={inputClass} required /></Field>
            <Field label="Heading in pink"><input name="title_accent" defaultValue={banner.title_accent ?? ""} className={inputClass} /></Field>
          </div>
          <Field label="Paragraph"><textarea name="body" defaultValue={banner.body ?? ""} rows={3} className={`${inputClass} h-auto py-2.5`} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main button"><input name="primary_label" defaultValue={banner.primary_label} className={inputClass} /></Field>
            <Field label="Main button link"><input name="primary_href" defaultValue={banner.primary_href} className={inputClass} /></Field>
            <Field label="Second button (optional)"><input name="secondary_label" defaultValue={banner.secondary_label ?? ""} className={inputClass} /></Field>
            <Field label="Second button link"><input name="secondary_href" defaultValue={banner.secondary_href ?? ""} className={inputClass} /></Field>
          </div>
          <Field label="Trust line (shown with 5 stars)"><input name="trust_text" defaultValue={banner.trust_text ?? ""} className={inputClass} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <Button size="lg" disabled={pending}>{pending ? "Saving…" : "Save Banner"}</Button>
          {msg && <p className={msg.ok ? "text-mint-fg" : "text-rose-fg"} role="status">{msg.text}</p>}
        </div>
      </form>
    </Card>
  );
}
