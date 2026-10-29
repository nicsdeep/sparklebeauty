import Link from "next/link";

/**
 * Text wordmark used until the official Sparkle logo file is added to /public/brand.
 * When it is, render that image here unchanged; do not redraw the logo.
 */
export function Logo({ href = "/", subtitle = "Beauty & Cosmetics" }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex flex-col leading-none" aria-label="Sparkle Beauty & Cosmetics home">
      <span className="text-[26px] font-extrabold tracking-tight text-brand-600">Sparkle</span>
      <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-logo-blue">{subtitle}</span>
    </Link>
  );
}
