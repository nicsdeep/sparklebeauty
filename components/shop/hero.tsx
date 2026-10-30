import { ArrowRight, MapPin, Star } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import type { HeroBanner } from "@/lib/hero";

/** Responsive sources for a banner image: the 1024px copy (if one exists) for phones. */
function sources(url: string) {
  const small = url.replace(/\.jpg$/, "-1024.jpg");
  return url.endsWith(".jpg") ? { srcSet: `${small} 1024w, ${url} 2048w`, sizes: "(min-width: 1024px) 1280px, 100vw" } : {};
}

/**
 * Homepage hero in two layers:
 *  1. the banner artwork (image only, from hero_banners.image_url) as the background;
 *  2. the logo, copy, buttons and trust row rendered on top as normal UI.
 * Swapping the banner image never needs a layout change.
 */
export function Hero({ banner, locationNote }: { banner: HeroBanner; locationNote?: string }) {
  return (
    <section className="relative -mx-4 -mt-6 overflow-hidden bg-brand-50 sm:mx-0 sm:mt-0 sm:rounded-3xl" aria-label="Featured">
      {/* Layer 1: background artwork */}
      <div className="relative h-60 sm:h-72 lg:absolute lg:inset-0 lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.image_url}
          {...sources(banner.image_url)}
          alt={banner.image_alt}
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ objectPosition: banner.image_focus }}
        />
        {/* Soft blush wash so the copy stays readable over any artwork on wide screens. */}
        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-brand-50 via-brand-50/80 to-transparent lg:block lg:w-[62%]" aria-hidden />
      </div>

      {/* Layer 2: content */}
      <div className="relative px-6 py-8 sm:px-10 lg:flex lg:min-h-[540px] lg:max-w-[56%] lg:flex-col lg:justify-center lg:px-14 lg:py-14">
        {banner.show_logo && <div className="mb-6 hidden lg:block"><Logo size="sm" /></div>}
        {banner.eyebrow && <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">{banner.eyebrow}</p>}
        <h1 className="mt-3 text-[2.5rem] font-extrabold leading-[1.04] tracking-tight text-ink sm:text-5xl lg:text-[3.6rem]">
          {banner.title}
          {banner.title_accent && <> <span className="text-brand-600">{banner.title_accent}</span></>}
        </h1>
        {banner.body && <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">{banner.body}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href={banner.primary_href} size="lg">{banner.primary_label} <ArrowRight className="size-5" /></ButtonLink>
          {banner.secondary_label && banner.secondary_href && (
            <ButtonLink href={banner.secondary_href} variant="secondary" size="lg">{banner.secondary_label}</ButtonLink>
          )}
        </div>
        {banner.trust_text && (
          <p className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink">
            <span className="flex" aria-label="5 out of 5">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden />)}
            </span>
            {banner.trust_text}
          </p>
        )}
        {locationNote && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><MapPin className="size-4 text-brand-600" /> {locationNote}</p>
        )}
      </div>
    </section>
  );
}
