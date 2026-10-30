import Link from "next/link";
import { cx } from "@/components/ui";

const HEIGHT = { sm: "h-12", md: "h-14 lg:h-[76px]", lg: "h-24" };
const FILE = { brand: "/brand/sparkle-logo.svg", footer: "/brand/sparkle-logo-footer.svg" };

/**
 * The Sparkle Beauty and Cosmetics logo, redrawn as clean vector curves from Nicholas's original
 * (td2/Sparkle_Beauty_Logo_Original_Clear.png). `brand` is the original pink and blue; `footer` is
 * the same design in rose and plum. Never redraw, crop or recolour it beyond these two files.
 */
export function Logo({ href = "/", subtitle, size = "md", tone = "brand" }: {
  href?: string;
  subtitle?: string;
  size?: keyof typeof HEIGHT;
  tone?: keyof typeof FILE;
}) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-3" aria-label="Sparkle Beauty and Cosmetics home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FILE[tone]} alt="Sparkle Beauty and Cosmetics" width={1313} height={1116} className={cx("w-auto", HEIGHT[size])} />
      {subtitle && <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{subtitle}</span>}
    </Link>
  );
}
