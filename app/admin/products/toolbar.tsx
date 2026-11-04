"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Download, ExternalLink, Filter, MoreHorizontal, Package } from "lucide-react";
import { FilterCombobox, UrlFilterChips } from "@/components/admin/list-controls";
import { LiveSearch } from "@/components/live-search";
import { buttonClass, cx } from "@/components/ui";

// Products list controls: search, a Filter panel (inline, opened in place), Sort and Export. Every
// choice is a URL parameter, so the list is read from the server and Back, refresh and links keep it.

export const SORTS = [["", "Featured first"], ["name", "Name A–Z"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["stock", "Stock: lowest first"], ["newest", "Newest first"]] as const;
export const STOCK_FILTERS = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
export const SHOW_FILTERS = { featured: "Featured", hidden: "Hidden from shop", visible: "Visible in shop" } as const;
const FILTER_PARAMS = ["category", "brand", "stock", "show"];

export function ProductsToolbar({ categories, brands }: { categories: { value: string; label: string; hint?: string }[]; brands: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = FILTER_PARAMS.filter((p) => params.get(p)).length;
  const [open, setOpen] = useState(active > 0);
  const sort = params.get("sort") ?? "";
  const setSort = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("sort", v); else next.delete("sort");
    next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const exportQuery = new URLSearchParams(params.toString());
  exportQuery.delete("page"); exportQuery.delete("size");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <LiveSearch placeholder="Search products by name, brand, category or SKU…" className="min-w-60 flex-1" />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={cx(buttonClass({ variant: "ghost" }), "h-11 border bg-white", active ? "border-brand-200 text-brand-700" : "border-line")}>
          <Filter className="size-4" /> Filter{active ? ` (${active})` : ""}
        </button>
        <label className={cx(buttonClass({ variant: "ghost" }), "relative h-11 border border-line bg-white")}>
          <ArrowUpDown className="size-4" /><span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="appearance-none bg-transparent pr-1 font-semibold outline-none" aria-label="Sort products">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <a href={`/admin/products/export${exportQuery.size ? `?${exportQuery}` : ""}`} className={cx(buttonClass({ variant: "ghost" }), "h-11 border border-line bg-white")} download>
          <Download className="size-4" /> Export CSV
        </a>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-3 md:grid-cols-4">
          <FilterCombobox label="Category" param="category" options={categories} allLabel="All categories" />
          <FilterCombobox label="Brand / Supplier" param="brand" options={brands.map((b) => ({ value: b, label: b }))} allLabel="All brands" />
          <FilterCombobox label="Stock" param="stock" options={Object.entries(STOCK_FILTERS).map(([value, label]) => ({ value, label }))} allLabel="All stock" />
          <FilterCombobox label="Shop" param="show" options={Object.entries(SHOW_FILTERS).map(([value, label]) => ({ value, label }))} allLabel="All products" />
        </div>
      )}
      <UrlFilterChips params={FILTER_PARAMS} labels={{
        category: Object.fromEntries(categories.map((c) => [c.value, c.label])), stock: STOCK_FILTERS, show: SHOW_FILTERS,
      }} />
    </div>
  );
}

/** The row's ⋯ menu: links to the product in the shop and its stock in Inventory. */
export function RowMenu({ name, slug, sku, active }: { name: string; slug: string; sku: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`More actions for ${name}`} aria-expanded={open} className="grid size-9 place-items-center rounded-lg hover:bg-surface">
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-line bg-white p-1 text-left text-sm shadow-xl" role="menu">
          {active && <Link href={`/product/${slug}`} target="_blank" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface"><ExternalLink className="size-4" /> View in shop</Link>}
          <Link href={`/admin/inventory?q=${encodeURIComponent(sku)}`} role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface"><Package className="size-4" /> Stock in Inventory</Link>
        </div>
      )}
    </div>
  );
}
