import Link from "next/link";
import { ProductImage } from "@/components/shop/product-image";
import { QuickAdd, WishlistHeart } from "@/components/shop/card-actions";
import { kes } from "@/lib/format";
import { productStock, type Product, type Stock } from "@/lib/catalog";

const NEW_DAYS = 30;

/** Badge for a card: a discount first, then Bestseller (featured), then New (added in the last 30 days). */
function badge(product: Product) {
  const v = product.variants[0];
  if (v.compare_at && v.compare_at > v.price) return `-${Math.round((1 - v.price / v.compare_at) * 100)}%`;
  if (product.is_featured) return "Bestseller";
  if (Date.now() - new Date(product.created_at).getTime() < NEW_DAYS * 86_400_000) return "New";
  return null;
}

/**
 * Product card: white, photo first, the price in Sparkle pink. The card opens the product, the
 * heart saves it, the cart button adds it (or asks for the option first).
 */
export function ProductCard({ product, stock, wishlisted = false, priority = false }: {
  product: Product;
  stock: Record<string, Stock>;
  wishlisted?: boolean;
  priority?: boolean;
}) {
  const cheapest = product.variants[0];
  const s = productStock(product, stock);
  const priceVaries = new Set(product.variants.map((v) => v.price)).size > 1;
  const href = `/product/${product.slug}`;
  const label = badge(product);
  // Only this product's stock goes to the cart button (a client component).
  const own = Object.fromEntries(product.variants.map((v) => [v.id, stock[v.id]]).filter(([, x]) => x));

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-white shadow-[0_2px_10px_-4px_rgba(31,26,29,0.08)] transition hover:shadow-[0_10px_28px_-12px_rgba(31,26,29,0.18)]">
      <div className="relative">
        <Link href={href} aria-label={product.name} tabIndex={-1}>
          <ProductImage category={product.category.slug} name={product.name} image={product.image} className="rounded-none" priority={priority} />
        </Link>
        {label && <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">{label}</span>}
        <WishlistHeart productId={product.id} slug={product.slug} initial={wishlisted} />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-brand-700">{product.name}</Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-ink-muted">{product.brand ?? product.category.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="min-w-0">
            {!s.inStock && <p className="text-xs font-semibold text-rose-fg">Out of stock</p>}
            {priceVaries && <p className="text-xs text-ink-muted">From</p>}
            <p className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
              <span className="whitespace-nowrap text-base font-bold text-brand-600 sm:text-lg">{kes(cheapest.price)}</span>
              {cheapest.compare_at && <span className="whitespace-nowrap text-xs text-ink-muted line-through sm:text-sm">{kes(cheapest.compare_at)}</span>}
            </p>
          </div>
          <div className="relative z-10"><QuickAdd product={product} stock={own} /></div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, stock, wishlist = [], columns = 4 }: {
  products: Product[];
  stock: Record<string, Stock>;
  wishlist?: string[];
  columns?: 3 | 4 | 6;
}) {
  const cols = { 3: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4", 4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4", 6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" }[columns];
  return (
    <div className={`grid gap-3 sm:gap-4 ${cols}`}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} stock={stock} wishlisted={wishlist.includes(p.id)} priority={i < 4} />
      ))}
    </div>
  );
}

/** Small card for side panels such as "You May Also Like": photo, brand, name, price and a cart icon. */
export function ProductMiniCard({ product, stock, wishlisted = false }: { product: Product; stock: Record<string, Stock>; wishlisted?: boolean }) {
  const cheapest = product.variants[0];
  const href = `/product/${product.slug}`;
  const own = Object.fromEntries(product.variants.map((v) => [v.id, stock[v.id]]).filter(([, x]) => x));
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-[0_10px_28px_-12px_rgba(31,26,29,0.18)]">
      <div className="relative">
        <Link href={href} aria-label={product.name} tabIndex={-1}>
          <ProductImage category={product.category.slug} name={product.name} image={product.image} size="sm" className="rounded-none" />
        </Link>
        <WishlistHeart productId={product.id} slug={product.slug} initial={wishlisted} />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-ink-muted">{product.brand ?? product.category.name}</span>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-brand-700">{product.name}</Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
          <span className="whitespace-nowrap text-sm font-bold text-brand-600">{new Set(product.variants.map((v) => v.price)).size > 1 ? <span className="text-xs font-medium text-ink-muted">From </span> : null}{kes(cheapest.price)}</span>
          <div className="relative z-10"><QuickAdd product={product} stock={own} /></div>
        </div>
      </div>
    </article>
  );
}
