import Link from "next/link";
import { Star } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { Badge, StockBadge } from "@/components/ui";
import { kes } from "@/lib/format";
import { productStock, type Product, type Stock } from "@/lib/catalog";

export function ProductCard({ product, stock }: { product: Product; stock: Record<string, Stock> }) {
  const cheapest = product.variants[0];
  const s = productStock(product, stock);
  const multiple = new Set(product.variants.map((v) => v.price)).size > 1;
  return (
    <Link href={`/product/${product.slug}`} className="group flex flex-col rounded-2xl border border-line bg-white p-3 transition hover:border-brand-200 hover:shadow-sm">
      <div className="relative">
        <ProductImage category={product.category.slug} name={product.name} brand={product.brand} />
        {cheapest.compare_at && (
          <Badge tone="brand" className="absolute left-2 top-2 bg-brand-600 text-white">
            -{Math.round((1 - cheapest.price / cheapest.compare_at) * 100)}%
          </Badge>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{product.category.name}</span>
        <h3 className="font-semibold leading-snug group-hover:text-brand-700">{product.name}</h3>
        <div className="flex items-center gap-1 text-sm text-ink-muted">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
          {product.rating.toFixed(1)} <span>({product.review_count})</span>
        </div>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
          <span className="text-lg font-bold text-brand-700">{multiple ? "From " : ""}{kes(cheapest.price)}</span>
          {cheapest.compare_at && <span className="text-sm text-ink-muted line-through">{kes(cheapest.compare_at)}</span>}
        </div>
        <div className="pt-1">
          <StockBadge stock={s} />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, stock }: { products: Product[]; stock: Record<string, Stock> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} stock={stock} />
      ))}
    </div>
  );
}
