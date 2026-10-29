import { Brush, Droplets, Gem, Scissors, Sparkles, SprayCan, Waves, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS: Record<string, LucideIcon> = {
  wigs: Waves,
  "hair-pieces": Scissors,
  braids: Waves,
  extensions: Waves,
  "hair-care": Droplets,
  cosmetics: Brush,
  skincare: Droplets,
  perfumes: SprayCan,
  accessories: Gem,
};

/**
 * Product image slot. Shows the product photo when one exists; until real photography is
 * uploaded it shows a clean branded placeholder (no generated imagery).
 */
export function ProductImage({ category, name, brand, size = "md", className }: {
  category: string;
  name: string;
  brand?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = ICONS[category] ?? Sparkles;
  return (
    <div className={cx("relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-brand-50", className)} role="img" aria-label={name}>
      <Icon className={cx("text-brand-500/80", size === "lg" ? "size-20" : size === "sm" ? "size-7" : "size-12")} strokeWidth={1.4} aria-hidden />
      {size !== "sm" && brand && (
        <span className={cx("mt-3 px-3 text-center font-semibold uppercase tracking-[0.14em] text-brand-700/70", size === "lg" ? "text-sm" : "text-[11px]")}>
          {brand}
        </span>
      )}
    </div>
  );
}
