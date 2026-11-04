"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Heart, ShoppingCart } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ProductImage } from "@/components/shop/product-image";
import { Button, StockBadge, cx } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { kes } from "@/lib/format";
import type { Product, Stock, Variant } from "@/lib/catalog";
import { variantLabel } from "@/lib/variant";
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
      className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
    >
      <Heart className={cx("size-[18px]", saved ? "fill-brand-600 text-brand-600" : "text-ink")} />
    </button>
  );
}

const cartItem = (product: Product, v: Variant) => ({
  variantId: v.id, slug: product.slug, name: product.name, variantName: product.variants.length > 1 ? variantLabel(v) : null,
  category: product.category.slug, brand: product.brand, image: product.image, price: v.price,
});

/**
 * The cart button on product cards. A product with one option goes straight into the cart; a
 * product with options opens a picker first, so the customer chooses the exact variant (never a
 * guessed SKU).
 */
export function QuickAdd({ product, stock }: { product: Product; stock: Record<string, Stock> }) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);
  const [picking, setPicking] = useState(false);
  const only = product.variants.length === 1 ? product.variants[0] : null;
  const anyInStock = product.variants.some((v) => stock[v.id]?.inStock);
  const inCart = only ? items.find((i) => i.variantId === only.id)?.quantity ?? 0 : 0;
  const out = only ? (stock[only.id]?.available ?? 0) - inCart <= 0 : !anyInStock;

  const flash = () => { setAdded(true); setTimeout(() => setAdded(false), 2000); };
  return (
    <>
      <button type="button" disabled={out}
        onClick={() => { if (only) { add(cartItem(product, only), 1); flash(); } else setPicking(true); }}
        aria-label={added ? `${product.name} added to cart` : out ? `${product.name} unavailable` : only ? `Add ${product.name} to cart` : `Choose options for ${product.name}`}
        className={cx("grid size-10 shrink-0 place-items-center rounded-xl transition disabled:opacity-40",
          added ? "bg-mint-bg text-mint-fg" : "bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white")}>
        {added ? <Check className="size-[18px]" /> : <ShoppingCart className="size-[18px]" />}
      </button>
      {!only && <VariantPicker product={product} stock={stock} open={picking} onClose={() => setPicking(false)} onAdded={flash} />}
    </>
  );
}

function VariantPicker({ product, stock, open, onClose, onAdded }: {
  product: Product; stock: Record<string, Stock>; open: boolean; onClose: () => void; onAdded: () => void;
}) {
  const { add, items } = useCart();
  const params = useSearchParams();
  const [variantId, setVariantId] = useState<string | null>(null);
  // With Shop filters set (e.g. Brown, 18"), start on the one option that matches them.
  useEffect(() => {
    if (!open) return;
    const want = { color: params.get("color"), length: params.get("length"), size: params.get("size") };
    if (!want.color && !want.length && !want.size) return;
    const hits = product.variants.filter((v) => (!want.color || (v.color ?? v.shade) === want.color) && (!want.length || v.hair_length === want.length) && (!want.size || v.size === want.size));
    if (hits.length === 1) setVariantId(hits[0].id);
  }, [open, params, product.variants]);
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const inCart = variant ? items.find((i) => i.variantId === variant.id)?.quantity ?? 0 : 0;
  const canAdd = !!variant && (stock[variant.id]?.available ?? 0) - inCart > 0;
  const priceVaries = new Set(product.variants.map((v) => v.price)).size > 1;

  return (
    <Sheet open={open} onClose={onClose} title="Choose an option"
      footer={
        <Button className="w-full" size="lg" disabled={!canAdd}
          onClick={() => { if (!variant) return; add(cartItem(product, variant), 1); onAdded(); onClose(); }}>
          <ShoppingCart className="size-5" /> {!variant ? "Choose an option" : canAdd ? `Add to Cart · ${kes(variant.price)}` : stock[variant.id]?.inStock ? "All stock in your cart" : "Out of stock"}
        </Button>
      }>
      <div className="flex items-center gap-3">
        <div className="w-20 shrink-0"><ProductImage category={product.category.slug} name={product.name} image={product.image} size="sm" priority /></div>
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{product.name}</p>
          {product.brand && <p className="text-sm text-ink-muted">{product.brand}</p>}
          <p className="mt-1 font-bold text-brand-600">{variant ? kes(variant.price) : `${priceVaries ? "From " : ""}${kes(product.variants[0].price)}`}</p>
        </div>
      </div>
      <fieldset className="mt-5">
        <legend className="mb-2.5 text-sm font-semibold">Option{variant && <span className="font-normal text-ink-muted">: {variantLabel(variant)}</span>}</legend>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => {
            const s = stock[v.id];
            return (
              <button key={v.id} type="button" onClick={() => setVariantId(v.id)} aria-pressed={v.id === variantId}
                className={cx("rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition",
                  v.id === variantId ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line hover:border-ink/30",
                  !s?.inStock && "text-ink-muted line-through decoration-1")}>
                {variantLabel(v)}
                {priceVaries && <span className="block text-xs font-medium text-ink-muted">{kes(v.price)}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
      {variant && <div className="mt-4"><StockBadge stock={stock[variant.id]} showCount={!!stock[variant.id]?.low} /></div>}
      <Link href={`/product/${product.slug}`} onClick={onClose} className="mt-5 inline-block text-sm font-semibold text-brand-700">View full details</Link>
    </Sheet>
  );
}
