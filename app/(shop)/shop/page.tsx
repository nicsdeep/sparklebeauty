import Link from "next/link";
import type { Metadata } from "next";
import { LiveSearch } from "@/components/live-search";
import { ProductGrid } from "@/components/shop/product-card";
import { SortSelect } from "@/components/shop/sort-select";
import { EmptyState, cx } from "@/components/ui";
import { getCategories, getStock, listProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop" };

type Search = { category?: string; q?: string; offers?: string; brand?: string; sort?: string };

const SORTS = [
  { value: "", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
];

export default async function ShopPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [categories, products] = await Promise.all([
    getCategories(),
    listProducts({ category: sp.category, q: sp.q, offers: sp.offers === "1", brand: sp.brand, sort: sp.sort }),
  ]);
  const stock = await getStock(products.flatMap((p) => p.variants.map((v) => v.id)));
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort() as string[];
  const current = categories.find((c) => c.slug === sp.category);
  const parent = current?.parent_id ? categories.find((c) => c.id === current.parent_id) : current;
  const children = parent ? categories.filter((c) => c.parent_id === parent.id) : [];

  const href = (patch: Partial<Search>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shop${next.toString() ? `?${next}` : ""}`;
  };
  const title = sp.q ? `Results for “${sp.q}”` : sp.offers === "1" ? "Offers" : current?.name ?? "All products";

  return (
    <div>
      <nav className="mb-3 text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link> /{" "}
        <Link href="/shop" className="hover:text-brand-700">Shop</Link>
        {parent && parent !== current && <> / <Link href={href({ category: parent.slug, brand: undefined })} className="hover:text-brand-700">{parent.name}</Link></>}
        {current && <> / <span className="text-ink">{current.name}</span></>}
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-ink-muted">{products.length} products{current?.description ? ` · ${current.description}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveSearch placeholder="Search in the shop" className="w-56 max-w-full" />
          <SortSelect options={SORTS} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Category</h2>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              <FilterLink href={href({ category: undefined, brand: undefined })} active={!sp.category}>All products</FilterLink>
              {categories.filter((c) => !c.parent_id).map((c) => (
                <FilterLink key={c.id} href={href({ category: c.slug, brand: undefined })} active={sp.category === c.slug}>{c.name}</FilterLink>
              ))}
            </div>
          </div>
          {children.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{parent?.name}</h2>
              <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {children.map((c) => (
                  <FilterLink key={c.id} href={href({ category: c.slug, brand: undefined })} active={sp.category === c.slug}>{c.name}</FilterLink>
                ))}
              </div>
            </div>
          )}
          {brands.length > 1 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Brand</h2>
              <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                <FilterLink href={href({ brand: undefined })} active={!sp.brand}>All brands</FilterLink>
                {brands.map((b) => <FilterLink key={b} href={href({ brand: b })} active={sp.brand === b}>{b}</FilterLink>)}
              </div>
            </div>
          )}
          <FilterLink href={href({ offers: sp.offers === "1" ? undefined : "1" })} active={sp.offers === "1"}>On offer only</FilterLink>
        </aside>
        <div>
          {products.length ? (
            <ProductGrid products={products} stock={stock} />
          ) : (
            <EmptyState title="No products found">Try another search or <Link href="/shop" className="font-semibold text-brand-700">browse all products</Link>.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("rounded-full px-3 py-1.5 text-[15px] lg:rounded-lg", active ? "bg-brand-50 font-semibold text-brand-700" : "border border-line hover:bg-surface lg:border-0")}>
      {children}
    </Link>
  );
}
