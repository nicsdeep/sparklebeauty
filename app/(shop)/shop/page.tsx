import Link from "next/link";
import type { Metadata } from "next";
import { Brush, Droplets, Gem, Sparkles, SprayCan } from "lucide-react";
import { SearchSuggest } from "@/components/search-suggest";
import { ProductGrid } from "@/components/shop/product-card";
import { ActiveFilters, BrandSheet, FilterButton, FilterPanel, MoreCategories, SortMenu, type ShopCategory } from "@/components/shop/shop-controls";
import { Pagination } from "@/components/admin/list-controls";
import { EmptyState, cx } from "@/components/ui";
import { getCategories, getFeaturedBrands, getStock, getWishlistIds, listProducts } from "@/lib/catalog";
import { applyFilters, facets as facetsOf, type ShopQuery } from "@/lib/shop-filters";
import { pageParams } from "@/lib/pagination";

export const metadata: Metadata = { title: "Shop" };

/** A simple hair silhouette (lucide has no hair icon). */
function HairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 21c-2-3-3-7-2.5-10.5C5 6 8 3 12 3s7 3 7.5 7.5C20 14 19 18 17 21" />
      <path d="M9 20c-1-2.5-1.3-5-.8-7.5C8.7 10 10 8.5 12 8.5s3.3 1.5 3.8 4c.5 2.5.2 5-.8 7.5" />
    </svg>
  );
}
const TILE: Record<string, { Icon: typeof Brush | typeof HairIcon; label?: string }> = {
  hair: { Icon: HairIcon, label: "Hair & Wigs" },
  cosmetics: { Icon: Brush },
  skincare: { Icon: Droplets },
  perfumes: { Icon: SprayCan },
  accessories: { Icon: Gem },
};

/**
 * The Shop page is the product-discovery workspace: heading, search, quick categories, a few
 * brands, Filter / Sort, then products straight away. Everything is in the URL, so Back from a
 * product returns to the same search, filters, sort, page and scroll position.
 */
export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopQuery> }) {
  const sp = await searchParams;
  const [categories, base, featuredBrands, wishlist] = await Promise.all([
    getCategories(),
    listProducts({ category: sp.category, q: sp.q, sort: sp.sort }),
    getFeaturedBrands(),
    getWishlistIds(),
  ]);
  const stock = await getStock(base.flatMap((p) => p.variants.map((v) => v.id)));
  const products = applyFilters(base, sp, stock);
  const facets = facetsOf(base, sp, stock);
  const { page, size } = pageParams({ page: sp.page, size: "20" });
  const shown = products.slice((page - 1) * size, page * size);

  const tree: ShopCategory[] = categories.filter((c) => !c.parent_id)
    .map((c) => ({ slug: c.slug, name: TILE[c.slug]?.label ?? c.name, children: categories.filter((ch) => ch.parent_id === c.id).map((ch) => ({ slug: ch.slug, name: ch.name })) }));
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, TILE[c.slug]?.label ?? c.name]));
  const current = categories.find((c) => c.slug === sp.category);
  const title = current ? categoryNames[current.slug] : sp.offers === "1" ? "Offers & Deals" : "All Products";
  // Featured brands first (chosen in brands.featured_rank); without any, the brands with most products here.
  const brandRow = featuredBrands.length ? featuredBrands.map((b) => b.name)
    : [...facets.brands].sort((a, b) => b.count - a.count).slice(0, 4).map((b) => b.value);
  const brandHref = (name: string) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "brand") as [string, string][]);
    if (sp.brand !== name) next.set("brand", name);
    return `/shop${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="-mt-2 md:mt-0">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-0.5 text-ink-muted">{products.length} product{products.length === 1 ? "" : "s"}</p>

      <SearchSuggest scope="shop" live id="search" placeholder="Search products, brands, categories..." defaultValue={sp.q ?? ""}
        className="mt-4 max-w-2xl" inputClassName="h-12 rounded-full border border-line bg-white text-[16px] shadow-[0_1px_6px_-2px_rgba(31,26,29,0.08)] focus:border-brand-500 [&::-webkit-search-cancel-button]:hidden" />

      {/* Quick categories: one row, scrolls sideways on small phones */}
      <nav aria-label="Categories" className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-1 sm:gap-3">
          {tree.map((c) => {
            const { Icon } = TILE[c.slug] ?? { Icon: Sparkles };
            const active = sp.category === c.slug || c.children.some((ch) => ch.slug === sp.category);
            return (
              <li key={c.slug}>
                <Link href={active ? "/shop" : `/shop?category=${c.slug}`} aria-current={active ? "page" : undefined} className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[88px]">
                  <span className={cx("grid size-14 place-items-center rounded-2xl transition sm:size-16", active ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100")}>
                    <Icon className="size-6" />
                  </span>
                  <span className={cx("text-[13px] leading-tight sm:text-sm", active ? "font-semibold text-brand-700" : "font-medium")}>{c.name}</span>
                </Link>
              </li>
            );
          })}
          <li><MoreCategories categories={tree} /></li>
        </ul>
      </nav>

      {brandRow.length > 0 && (
        <section className="mt-5" aria-labelledby="brands-heading">
          <div className="flex items-center justify-between">
            <h2 id="brands-heading" className="text-lg font-bold">Shop by Brands</h2>
            <BrandSheet brands={facets.brands} />
          </div>
          <ul className="-mx-4 mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {brandRow.map((name) => (
              <li key={name} className="shrink-0">
                <Link href={brandHref(name)} aria-pressed={sp.brand === name}
                  className={cx("flex h-12 items-center rounded-full border bg-white px-5 text-[15px] font-bold tracking-tight shadow-[0_1px_6px_-2px_rgba(31,26,29,0.08)] transition",
                    sp.brand === name ? "border-brand-600 text-brand-700" : "border-line hover:border-ink/30")}>
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 grid gap-6 border-t border-line pt-4 lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-36"><FilterPanel categories={tree} facets={facets} /></div>
        </aside>
        <div id="products" className="min-w-0 scroll-mt-36">
          <div className="flex items-center gap-3">
            <FilterButton categories={tree} facets={facets} total={products.length} />
            <span className="hidden h-6 w-px bg-line sm:block lg:hidden" aria-hidden />
            <p className="hidden text-sm text-ink-muted lg:block">{products.length} product{products.length === 1 ? "" : "s"}</p>
            <div className="ml-auto min-w-0"><SortMenu /></div>
          </div>
          <div className="mt-3 empty:hidden"><ActiveFilters categoryNames={categoryNames} /></div>

          <div className="mt-4">
            {shown.length ? (
              <ProductGrid products={shown} stock={stock} wishlist={wishlist} columns={3} />
            ) : (
              <EmptyState title={sp.q ? `No products found for “${sp.q}”` : "No products match these filters"}>
                Try another search or <Link href="/shop" className="font-semibold text-brand-700">clear the filters</Link>.
              </EmptyState>
            )}
          </div>
          {products.length > size && <div className="mt-6"><Pagination page={page} size={size} total={products.length} noun="products" anchor="products" /></div>}
        </div>
      </div>
    </div>
  );
}
