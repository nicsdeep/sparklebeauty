"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Star, X } from "lucide-react";
import { Button, cx, inputClass } from "@/components/ui";
import { sized } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

export const PHOTO_BUCKET = "product-images";
const MAX_PHOTOS = 10;
const MAX_SIDE = 1600;

/** Shrinks a phone photo to at most 1600px on its longest side and re-encodes it as JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.85));
}

/**
 * Product photos: upload from the device (straight to the product-images bucket; staff only by
 * RLS), or paste a site path / https link. The first photo is the main one. Files removed here
 * are deleted from storage only after the product is saved (see updateProduct).
 */
export function PhotoManager({ photos, onChange, folder }: { photos: string[]; onChange: (photos: string[]) => void; folder: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setError(`A product can have up to ${MAX_PHOTOS} photos.`);
    const supabase = createClient();
    const added: string[] = [];
    setBusy(list.length);
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
        const blob = await shrink(file);
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: e } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (e) throw e;
        added.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      } catch (e) {
        setError((e as Error).message || "Upload failed. Try again.");
      }
      setBusy((b) => b - 1);
    }
    if (added.length) onChange([...photos, ...added]);
    if (input.current) input.current.value = "";
  }

  const move = (i: number, d: number) => {
    const next = [...photos];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {photos.map((p, i) => (
          <div key={p} className={cx("group relative aspect-square overflow-hidden rounded-xl border-2 bg-brand-50", i === 0 ? "border-brand-600" : "border-line")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sized(p, 240, 240)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white"><Star className="size-3" /> Main</span>}
            <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-rose-fg shadow-sm"><X className="size-4" /></button>
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
              {i > 0 ? <button type="button" onClick={() => move(i, -1)} aria-label={`Move photo ${i + 1} earlier`} className="grid size-7 place-items-center rounded-full bg-white/95 shadow-sm"><ArrowLeft className="size-4" /></button> : <span />}
              {i < photos.length - 1 && <button type="button" onClick={() => move(i, 1)} aria-label={`Move photo ${i + 1} later`} className="grid size-7 place-items-center rounded-full bg-white/95 shadow-sm"><ArrowRight className="size-4" /></button>}
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy > 0}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-200 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60">
            <ImagePlus className="size-7" strokeWidth={1.6} />
            {busy > 0 ? `Uploading ${busy}…` : "Add photos"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a photo link (https://… or /products/…)" className={cx(inputClass, "pl-9")} />
        </div>
        <Button type="button" variant="secondary" disabled={!link.trim() || photos.length >= MAX_PHOTOS}
          onClick={() => {
            const v = link.trim();
            if (!/^(\/|https:\/\/)/.test(v)) return setError("Links must start with https:// or /.");
            if (!photos.includes(v)) onChange([...photos, v]);
            setLink(""); setError(null);
          }}>Add link</Button>
      </div>
      <p className="text-sm text-ink-muted">JPEG, PNG or WebP. Large photos are resized to 1600px. The first photo is the main one; use the arrows to reorder.</p>
      {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
    </div>
  );
}
