import { Brush, Droplets, Gem, Scissors, Sparkles, SprayCan, Waves, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import { productImageUrl, sized } from "@/lib/images";

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

const WIDTH = { sm: 240, md: 480, lg: 900 };

/**
 * Product photo (products.image_urls), falling back to a category photo, and finally to a
 * branded icon tile if neither exists.
 */
export function ProductImage({ category, name, image, size = "md", priority = false, className }: {
  category: string;
  name: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
}) {
  const url = productImageUrl(image, category);
  if (url) {
    const w = WIDTH[size];
    return (
      <div className={cx("relative aspect-square w-full overflow-hidden rounded-xl bg-brand-50", className)}>
        {/* Plain img: the Unsplash CDN resizes, so Next's optimiser isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sized(url, w, w)}
          srcSet={`${sized(url, w, w)} 1x, ${sized(url, w * 2, w * 2)} 2x`}
          alt={name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
    );
  }
  const Icon = ICONS[category] ?? Sparkles;
  return (
    <div className={cx("flex aspect-square w-full items-center justify-center rounded-xl bg-brand-50", className)} role="img" aria-label={name}>
      <Icon className={cx("text-brand-500/80", size === "lg" ? "size-20" : size === "sm" ? "size-7" : "size-12")} strokeWidth={1.4} aria-hidden />
    </div>
  );
}
