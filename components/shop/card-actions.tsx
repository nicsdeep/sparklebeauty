"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Heart, ShoppingBag } from "lucide-react";
import { buttonClass, cx } from "@/components/ui";
import { useCart, type CartItem } from "@/lib/cart";
import { toggleWishlist } from "@/app/(shop)/actions";

export function WishlistHeart({ productId, slug, initial }: { productId: string; slug: string; initial: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleWishlist(productId);
          if (!res.ok && res.error === "signin") router.push(`/login?next=/product/${slug}`);
          else if (res.ok) setSaved(res.data.saved);
        })
      }
      className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
    >
      <Heart className={cx("size-[18px]", saved ? "fill-brand-600 text-brand-600" : "text-ink")} />
    </button>
  );
}

/**
 * Adds a single-option product straight to the cart; products with options go to their page.
 * `compact` renders a round cart icon (for small cards) instead of a full-width button.
 */
export function QuickAdd({ item, hasOptions, available, slug, compact = false }: {
  item: Omit<CartItem, "quantity">;
  hasOptions: boolean;
  available: number;
  slug: string;
  compact?: boolean;
}) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.find((i) => i.variantId === item.variantId)?.quantity ?? 0;

  const iconClass = "grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-600 hover:text-white disabled:opacity-40";
  if (hasOptions) {
    if (compact) return <Link href={`/product/${slug}`} aria-label={`Choose options for ${item.name}`} className={iconClass}><ShoppingBag className="size-4" /></Link>;
    return <Link href={`/product/${slug}`} className={cx(buttonClass({ size: "sm" }), "w-full")}>Select Options</Link>;
  }
  const out = available - inCart <= 0;
  const onAdd = () => {
    add(item, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  if (compact) {
    return (
      <button type="button" disabled={out} onClick={onAdd} className={iconClass}
        aria-label={added ? `${item.name} added to cart` : out ? `${item.name} unavailable` : `Add ${item.name} to cart`}>
        {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={out}
      onClick={onAdd}
      className={cx(buttonClass({ size: "sm" }), "w-full")}
    >
      {added ? <><Check className="size-4" /> Added</> : out ? (available <= 0 ? "Out of Stock" : "All in Cart") : <><ShoppingBag className="size-4" /> Add to Cart</>}
    </button>
  );
}
