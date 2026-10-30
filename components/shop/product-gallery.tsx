"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cx } from "@/components/ui";
import { productImageUrl, sized } from "@/lib/images";

/**
 * Product photos (products.image_urls): a large main image with previous/next controls, swipe
 * on touch screens, thumbnails, and a full-screen view. Falls back to the category photo.
 */
export function ProductGallery({ images, category, name }: { images: string[]; category: string; name: string }) {
  const fallback = productImageUrl(null, category);
  const photos = images.length ? images : fallback ? [fallback] : [];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touchX = useRef<number | null>(null);
  const many = photos.length > 1;
  const go = (step: number) => setIndex((i) => (i + step + photos.length) % photos.length);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!photos.length) return <div className="aspect-square w-full rounded-3xl bg-brand-50" role="img" aria-label={name} />;
  const current = photos[index];

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-3xl bg-brand-50"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null || !many) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sized(current, 900, 900)} srcSet={`${sized(current, 900, 900)} 1x, ${sized(current, 1600, 1600)} 2x`}
          alt={many ? `${name}, photo ${index + 1} of ${photos.length}` : name} className="h-full w-full object-cover" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-brand-700 shadow-sm">
          <BadgeCheck className="size-4" aria-hidden /> Original Product
        </span>
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-md transition hover:text-brand-700">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo"
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-md transition hover:text-brand-700">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
              {photos.map((p, i) => <span key={p} className={cx("size-2 rounded-full", i === index ? "bg-brand-600" : "bg-white/90")} />)}
            </span>
          </>
        )}
        <button type="button" onClick={() => setZoom(true)} aria-label="View full screen"
          className="absolute bottom-3 right-3 grid size-11 place-items-center rounded-full bg-white/95 text-ink shadow-md transition hover:text-brand-700">
          <Expand className="size-5" />
        </button>
      </div>

      {many && (
        <div className="flex gap-2.5 overflow-x-auto lg:w-20 lg:shrink-0 lg:flex-col lg:overflow-visible" role="group" aria-label="Product photos">
          {photos.map((p, i) => (
            <button key={p} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
              className={cx("size-18 shrink-0 overflow-hidden rounded-2xl border-2 bg-brand-50 transition lg:size-20",
                i === index ? "border-brand-600" : "border-transparent opacity-80 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sized(p, 160, 160)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4" role="dialog" aria-modal="true" aria-label={name} onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(current, 1600, 1600)} alt={name} className="max-h-full max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setZoom(false)} aria-label="Close" autoFocus
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-ink"><X className="size-5" /></button>
          {many && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo"
                className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo"
                className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink"><ChevronRight className="size-5" /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
