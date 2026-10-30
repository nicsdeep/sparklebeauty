import Link from "next/link";
import { cx } from "@/components/ui";

const HEIGHT = { sm: "h-12", md: "h-14 lg:h-[76px]", lg: "h-24" };

/**
 * The official Sparkle Beauty and Cosmetics logo (public/brand/sparkle-logo.png, trimmed from
 * Nicholas's original file). Shown as supplied: never redraw, recolour or crop it.
 */
export function Logo({ href = "/", subtitle, size = "md" }: { href?: string; subtitle?: string; size?: keyof typeof HEIGHT }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-3" aria-label="Sparkle Beauty and Cosmetics home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/sparkle-logo.png" alt="Sparkle Beauty and Cosmetics" width={424} height={360} className={cx("w-auto", HEIGHT[size])} />
      {subtitle && <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{subtitle}</span>}
    </Link>
  );
}
