import { ProductImage } from "@/components/shop/product-image";
import { cx } from "@/components/ui";
import { kes } from "@/lib/format";

// One exact sellable variant (SKU) as a search result (UX doctrine §26, §32, §34): image, name,
// variant, category and brand, SKU, price and compact stock text. Shared by every product search.

/** "Brown · 18"": the attributes that tell variants apart. */
export function variantText(v: { color?: string | null; shade?: string | null; length?: string | null; size?: string | null; variantName?: string | null }) {
  const parts = [v.color ?? v.shade, v.length ?? v.size].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : v.variantName ?? "";
}

/** "24 available", "Low · 4 left" or "Out of stock", with its tone (green, amber, red). */
export function stockText(available: number, low: boolean) {
  if (available <= 0) return { text: "Out of stock", className: "text-rose-fg" };
  if (low) return { text: `Low · ${available} left`, className: "text-amber-fg" };
  return { text: `${available} available`, className: "text-mint-fg" };
}

export function ProductResultRow({ image, category, name, variant, meta, sku, price, available, low, active, lastKnown }: {
  image: string | null; category: string; name: string; variant: string;
  /** e.g. "Wigs · Sparkle Signature" */
  meta: string; sku: string; price: number; available: number; low: boolean;
  /** Highlighted by the keyboard. */
  active?: boolean;
  /** Stock is the last count seen before the connection dropped. */
  lastKnown?: boolean;
}) {
  const stock = stockText(available, low);
  return (
    <span className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", active ? "bg-surface" : "hover:bg-surface", available <= 0 && "opacity-60")}>
      <span className="size-11 shrink-0"><ProductImage category={category} name={name} image={image} size="sm" className="rounded-md" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{name}{variant ? <span className="font-normal text-ink-muted"> — {variant}</span> : null}</span>
        <span className="block truncate text-xs text-ink-muted">{meta}</span>
        <span className="block truncate font-mono text-[11px] text-ink-muted">SKU {sku}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-brand-700 tabular-nums">{kes(price)}</span>
        <span className={cx("block text-xs font-medium", stock.className)}>{stock.text}{lastKnown && available > 0 ? " (last known)" : ""}</span>
      </span>
    </span>
  );
}
