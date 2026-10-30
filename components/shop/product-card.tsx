import Link from "next/link";
import { Star } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { QuickAdd, WishlistHeart } from "@/components/shop/card-actions";
import { StockBadge } from "@/components/ui";
import { kes } from "@/lib/format";
import { productStock, type Product, type Stock } from "@/lib/catalog";
import { variantLabel } from "@/lib/variant";

export function ProductCard({ product, stock, wishlisted = false, priority = false }: {
  product: Product;
  stock: Record<string, Stock>;
  wishlisted?: boolean;
  priority?: boolean;
}) {
  const cheapest = product.variants[0];
  const s = productStock(product, stock);
  const hasOptions = product.variants.length > 1;
  const priceVaries = new Set(product.variants.map((v) => v.price)).size > 1;
  const discount = cheapest.compare_at ? Math.round((1 - cheapest.price / cheapest.compare_at) * 100) : 0;
  const href = `/product/${product.slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand-200 hover:shadow-[0_8px_24px_-12px_rgba(208,35,122,0.25)]">
      <div className="relative">
        <Link href={href} aria-label={product.name} tabIndex={-1}>
          <ProductImage category={product.category.slug} name={product.name} image={product.image} className="rounded-none" priority={priority} />
        </Link>
        {discount > 0 ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">{discount}% OFF</span>
        ) : product.is_featured ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-700 shadow-sm">Best Seller</span>
        ) : null}
        <WishlistHeart productId={product.id} slug={product.slug} initial={wishlisted} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{product.brand ?? product.category.name}</span>
        <h3 className="line-clamp-2 min-h-[2.6em] font-semibold leading-snug">
          <Link href={href} className="hover:text-brand-700">{product.name}</Link>
        </h3>
        <div className="flex items-center gap-1 text-sm text-ink-muted">
          <span className="flex" aria-label={`Rated ${product.rating.toFixed(1)} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={i <= Math.round(product.rating) ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-line"} aria-hidden />
            ))}
          </span>
          <span>({product.review_count})</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold">{priceVaries ? <span className="text-sm font-medium text-ink-muted">From </span> : null}{kes(cheapest.price)}</span>
          {cheapest.compare_at && <span className="text-sm text-ink-muted line-through">{kes(cheapest.compare_at)}</span>}
        </div>
        <div><StockBadge stock={s} /></div>
        <div className="mt-auto pt-2">
          <QuickAdd
            slug={product.slug}
            hasOptions={hasOptions}
            available={stock[cheapest.id]?.available ?? 0}
            item={{ variantId: cheapest.id, slug: product.slug, name: product.name, variantName: hasOptions ? variantLabel(cheapest) : null,
              category: product.category.slug, brand: product.brand, image: product.image, price: cheapest.price }}
          />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, stock, wishlist = [], columns = 4 }: {
  products: Product[];
  stock: Record<string, Stock>;
  wishlist?: string[];
  /** 2 = a side panel: two across on large screens, four across on tablets. */
  columns?: 2 | 4 | 6;
}) {
  const grid = {
    2: "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-2",
    4: "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4",
    6: "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6",
  };
  return (
    <div className={grid[columns]}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} stock={stock} wishlisted={wishlist.includes(p.id)} priority={i < 4} />
      ))}
    </div>
  );
}
