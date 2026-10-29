"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Heart, Minus, Plus } from "lucide-react";
import { Button, StockBadge, cx } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { kes } from "@/lib/format";
import type { Product, Stock } from "@/lib/catalog";
import { variantLabel } from "@/lib/variant";
import { toggleWishlist } from "@/app/(shop)/actions";

export function AddToCart({ product, stock, wishlisted }: { product: Product; stock: Record<string, Stock>; wishlisted: boolean }) {
  const router = useRouter();
  const { add, items } = useCart();
  const firstInStock = product.variants.find((v) => stock[v.id]?.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(wishlisted);
  const [pending, startTransition] = useTransition();

  const variant = product.variants.find((v) => v.id === variantId)!;
  const s = stock[variant.id];
  const inCart = items.find((i) => i.variantId === variant.id)?.quantity ?? 0;
  const maxQty = Math.max(0, (s?.available ?? 0) - inCart);
  const optionKind = useMemo(() => {
    const v = product.variants[0];
    if (product.variants.length < 2) return null;
    return v.hair_length && v.name === v.hair_length ? "Length" : v.shade ? "Shade" : v.size && v.name === v.size ? "Size" : v.color ? "Colour" : "Option";
  }, [product.variants]);

  function addToCart(buyNow: boolean) {
    add({ variantId: variant.id, slug: product.slug, name: product.name, variantName: product.variants.length > 1 ? variantLabel(variant) : null,
      category: product.category.slug, brand: product.brand, image: product.image, price: variant.price }, qty);
    if (buyNow) {
      router.push("/checkout");
      return;
    }
    setAdded(true);
    setQty(1);
    setTimeout(() => setAdded(false), 2500);
  }

  function wishlist() {
    startTransition(async () => {
      const res = await toggleWishlist(product.id);
      if (!res.ok && res.error === "signin") router.push(`/login?next=/product/${product.slug}`);
      else if (res.ok) setSaved(res.data.saved);
    });
  }

  const details = [
    ["Length", variant.hair_length],
    ["Colour", variant.color],
    ["Texture", variant.hair_texture],
    ["Hair type", variant.hair_type],
    ["Style", variant.hair_style],
    ["Shade", variant.shade],
    ["Size", variant.size],
    ["SKU", variant.sku],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold text-brand-700">{kes(variant.price)}</span>
        {variant.compare_at && <span className="text-lg text-ink-muted line-through">{kes(variant.compare_at)}</span>}
        <StockBadge stock={s} showCount={!!s?.low} />
      </div>

      {optionKind && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{optionKind}: <span className="font-normal text-ink-muted">{variantLabel(variant)}</span></legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const out = !stock[v.id]?.inStock;
              return (
                <button key={v.id} type="button" onClick={() => { setVariantId(v.id); setQty(1); }}
                  aria-pressed={v.id === variantId}
                  className={cx("min-w-16 rounded-xl border px-4 py-2.5 text-[15px] font-semibold transition",
                    v.id === variantId ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line hover:border-brand-200",
                    out && "text-ink-muted line-through decoration-1")}>
                  {variantLabel(v)}
                  {new Set(product.variants.map((x) => x.price)).size > 1 && <span className="block text-xs font-medium text-ink-muted no-underline">{kes(v.price)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Quantity</span>
        <div className="flex items-center rounded-full border border-line">
          <button type="button" className="p-3 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="size-4" /></button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
          <button type="button" className="p-3 disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus className="size-4" /></button>
        </div>
        {inCart > 0 && <span className="text-sm text-ink-muted">{inCart} already in your cart</span>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" className="flex-1 sm:flex-none sm:min-w-48" disabled={maxQty < 1} onClick={() => addToCart(false)}>
          {added ? <><Check className="size-5" /> Added to Cart</> : maxQty < 1 && s?.inStock ? "All stock in your cart" : s?.inStock ? "Add to Cart" : "Out of Stock"}
        </Button>
        <Button size="lg" variant="secondary" className="flex-1 sm:flex-none sm:min-w-40" disabled={maxQty < 1} onClick={() => addToCart(true)}>Buy Now</Button>
        <Button size="lg" variant="ghost" onClick={wishlist} disabled={pending} aria-pressed={saved} className="border border-line">
          <Heart className={cx("size-5", saved && "fill-brand-600 text-brand-600")} /> {saved ? "Saved" : "Wishlist"}
        </Button>
      </div>
      {added && (
        <p className="rounded-xl bg-mint-bg px-4 py-3 text-mint-fg" role="status">
          Added to your cart. <a href="/cart" className="font-semibold underline">View cart</a>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-surface p-4 text-[15px]">
        {details.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-ink-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
