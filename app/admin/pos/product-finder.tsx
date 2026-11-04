"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Check, ChevronDown, Flame, History, Plus, ScanBarcode, Search, TriangleAlert, X, Zap } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { Button, cx } from "@/components/ui";
import { kes } from "@/lib/format";
import { breakFor, nextBreak, type PriceBreak } from "@/lib/pricing";
import type { PosCategory, PosItem } from "./terminal";

// The till's product area (Nicholas's POS refinement, 2026-11-04): search first. Nothing is listed
// until the cashier searches, scans, filters or opens a section (Quick Picks, Recent, Fast-Moving,
// Low Stock, all from real sales and stock). Every option comes from the catalogue the page loaded
// from the database; a product's variants map to their exact SKU and stock record.

type Sheet = Record<string, PriceBreak[]>;
type Section = "quick" | "recent" | "fast" | "low";
const SECTIONS: { id: Section; label: string; Icon: typeof Zap; empty: string }[] = [
  { id: "quick", label: "Quick Picks", Icon: Zap, empty: "Best sellers of the last 90 days appear here." },
  { id: "recent", label: "Recent Products", Icon: History, empty: "Products you sell appear here." },
  { id: "fast", label: "Fast-Moving", Icon: Flame, empty: "No sales in the last 7 days yet." },
  { id: "low", label: "Low Stock", Icon: TriangleAlert, empty: "Nothing is running low." },
];
const STOCK = { all: "All Stock", in: "In Stock", low: "Low Stock", out: "Out of Stock" } as const;
type StockFilter = keyof typeof STOCK;
const ATTRS = [["color", "Color"], ["shade", "Shade"], ["length", "Length"], ["size", "Size"]] as const;
type Attr = (typeof ATTRS)[number][0];

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const stockOf = (i: PosItem): StockFilter => (i.available <= 0 ? "out" : i.low ? "low" : "in");

export function ProductFinder({ items, categories, sheet, activity, online, searchRef, qtyOf, onAdd }: {
  items: PosItem[]; categories: PosCategory[]; sheet: Sheet | undefined;
  activity: { quick: string[]; fast: string[]; recent: string[] };
  online: boolean; searchRef: RefObject<HTMLInputElement | null>;
  qtyOf: (variantId: string) => number;
  onAdd: (item: PosItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ category: "all", color: "", length: "", brand: "", stock: "all" as StockFilter });
  const [section, setSection] = useState<Section>("quick");
  const [picking, setPicking] = useState<PosItem[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const itemsBy = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const byProduct = useMemo(() => {
    const m = new Map<string, PosItem[]>();
    for (const i of items) m.set(i.productId, [...(m.get(i.productId) ?? []), i]);
    return m;
  }, [items]);

  // Filters work together; each list only offers values that exist with the other filters applied.
  const match = (i: PosItem, skip?: keyof typeof filters) =>
    (skip === "category" || filters.category === "all" || i.group === filters.category || i.category === filters.category)
    && (skip === "color" || !filters.color || i.color === filters.color || i.shade === filters.color)
    && (skip === "length" || !filters.length || i.length === filters.length || i.size === filters.length)
    && (skip === "brand" || !filters.brand || i.brand === filters.brand)
    && (skip === "stock" || filters.stock === "all" || stockOf(i) === filters.stock);
  const options = {
    category: categories.filter((c) => items.some((i) => match(i, "category") && (i.group === c.slug || i.category === c.slug))),
    color: uniq(items.filter((i) => match(i, "color")).flatMap((i) => [i.color, i.shade])),
    length: uniq(items.filter((i) => match(i, "length")).flatMap((i) => [i.length, i.size])),
    brand: uniq(items.filter((i) => match(i, "brand")).map((i) => i.brand)),
  };
  const filtering = filters.category !== "all" || !!filters.color || !!filters.length || !!filters.brand || filters.stock !== "all";
  const filtered = useMemo(() => (filtering ? items.filter((i) => match(i)).slice(0, 60) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filters, filtering]);

  // Autocomplete: products whose name, brand, category, variant, SKU or barcode match every word typed.
  const suggestions = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const hits: PosItem[][] = [];
    for (const variants of byProduct.values()) {
      const ok = variants.filter((v) => {
        const text = `${v.name} ${v.brand ?? ""} ${v.category} ${v.group} ${v.variantName ?? ""} ${v.color ?? ""} ${v.shade ?? ""} ${v.length ?? ""} ${v.size ?? ""} ${v.sku}`.toLowerCase();
        return words.every((w) => text.includes(w));
      });
      if (ok.length) hits.push(ok);
      if (hits.length >= 8) break;
    }
    return hits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, byProduct]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /** One variant: add it. Several: choose the exact one first. */
  function choose(variants: PosItem[]) {
    setError(null); setOpen(false);
    if (variants.length === 1) { onAdd(variants[0]); setQuery(""); return; }
    setPicking(byProduct.get(variants[0].productId) ?? variants);
  }

  // Enter: an exact SKU/barcode adds it at once; otherwise the first suggestion.
  function submit(e: FormEvent) {
    e.preventDefault();
    const code = query.trim().toLowerCase();
    if (!code) return;
    const exact = items.find((i) => i.sku.toLowerCase() === code);
    if (exact) { onAdd(exact); setQuery(""); setOpen(false); return; }
    if (suggestions[0]) choose(suggestions[0]);
    else setError(`No product matches “${query.trim()}”.`);
  }

  const sectionIds: Record<Section, string[]> = {
    quick: activity.quick, recent: activity.recent, fast: activity.fast,
    low: items.filter((i) => i.low && i.available > 0).sort((a, b) => a.available - b.available).slice(0, 12).map((i) => i.variantId),
  };
  const sectionItems = sectionIds[section].map((id) => itemsBy.get(id)).filter((x): x is PosItem => !!x);
  const select = "h-11 w-full appearance-none rounded-xl border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-300 focus:outline-none";

  return (
    <div className="space-y-4">
      <div ref={boxRef} className="relative">
        <form onSubmit={submit}>
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <input ref={searchRef} autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); setError(null); }} onFocus={() => setOpen(true)}
            className="h-13 w-full rounded-2xl border border-line bg-white pl-12 pr-20 text-base shadow-sm focus:border-brand-300 focus:outline-none"
            placeholder="Search product, SKU, barcode, brand or supplier…" aria-label="Search products or scan barcode" autoComplete="off"
            role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls="pos-suggestions" />
          <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-ink-muted">
            {query && <button type="button" onClick={() => { setQuery(""); setError(null); searchRef.current?.focus(); }} aria-label="Clear search"><X className="size-5" /></button>}
            <ScanBarcode className="size-5" aria-hidden />
          </span>
        </form>
        {open && suggestions.length > 0 && (
          <ul id="pos-suggestions" role="listbox" className="absolute z-30 mt-1.5 max-h-[60vh] w-full overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
            {suggestions.map((variants) => {
              const p = variants[0];
              const all = byProduct.get(p.productId) ?? variants;
              const colors = uniq(all.flatMap((v) => [v.color, v.shade]));
              const sizes = uniq(all.flatMap((v) => [v.length, v.size]));
              const stock = all.reduce((n, v) => n + Math.max(0, v.available), 0);
              const skuHit = variants.length === 1 && variants[0].sku.toLowerCase().includes(query.trim().toLowerCase()) ? variants[0].sku : null;
              return (
                <li key={p.productId} role="option" aria-selected={false}>
                  <button type="button" onClick={() => choose(variants)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface">
                    <span className="size-11 shrink-0"><ProductImage category={p.category} name={p.name} image={p.image} size="sm" className="rounded-lg" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{p.name}{variants.length === 1 && p.variantName ? ` (${p.variantName})` : ""}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {[categories.find((c) => c.slug === p.category)?.name ?? p.category, colors.length ? `Color: ${colors.join(", ")}` : null,
                          sizes.length ? `${all.some((v) => v.length) ? "Lengths" : "Sizes"}: ${sizes.join(", ")}` : null, p.brand ? `Brand: ${p.brand}` : null, skuHit ? `SKU ${skuHit}` : null]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", stock <= 0 ? "bg-rose-bg text-rose-fg" : "bg-mint-bg text-mint-fg")}>
                      {stock <= 0 ? "Out of stock" : `In Stock (${stock})`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="mt-1.5 text-sm text-rose-fg" role="alert">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {([
          ["Category", "category", [["all", "All Categories"], ...options.category.map((c) => [c.slug, c.name])]],
          ["Color", "color", [["", "All Colors"], ...options.color.map((c) => [c, c])]],
          ["Size / Length", "length", [["", "All Sizes"], ...options.length.map((c) => [c, c])]],
          ["Brand / Supplier", "brand", [["", "All Brands"], ...options.brand.map((c) => [c, c])]],
          ["Stock", "stock", Object.entries(STOCK)],
        ] as [string, keyof typeof filters, string[][]][]).map(([label, key, opts]) => (
          <label key={key} className="relative block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
            <select value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))} className={select}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-ink-muted" />
          </label>
        ))}
      </div>

      {filtering ? (
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <p className="font-semibold">{filtered.length === 60 ? "First 60 matches" : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}</p>
            <button onClick={() => setFilters({ category: "all", color: "", length: "", brand: "", stock: "all" })} className="font-semibold text-brand-700">Clear filters</button>
          </div>
          <ProductGrid list={filtered} sheet={sheet} online={online} qtyOf={qtyOf} onAdd={(i) => choose([i])} empty="No products match these filters." />
        </div>
      ) : (
        <div>
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}
                className={cx("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
                  section === id ? "border-brand-600 text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
                <Icon className={cx("size-4", section === id && "text-brand-600")} />{label}
              </button>
            ))}
          </div>
          <ProductGrid list={sectionItems} sheet={sheet} online={online} qtyOf={qtyOf} onAdd={(i) => choose([i])} empty={SECTIONS.find((s) => s.id === section)!.empty} />
        </div>
      )}

      {picking && <VariantPicker variants={picking} sheet={sheet} qtyOf={qtyOf} onClose={() => setPicking(null)} onAdd={(v) => { onAdd(v); setPicking(null); setQuery(""); }} />}
    </div>
  );
}

function ProductGrid({ list, sheet, online, qtyOf, onAdd, empty }: {
  list: PosItem[]; sheet: Sheet | undefined; online: boolean; qtyOf: (id: string) => number; onAdd: (i: PosItem) => void; empty: string;
}) {
  if (!list.length) return <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {list.map((i) => {
        const inCart = qtyOf(i.variantId);
        const left = i.available - inCart;
        const one = breakFor(sheet?.[i.variantId], 1);
        const bulk = nextBreak(sheet?.[i.variantId], 1);
        return (
          <article key={i.variantId} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
            <div className="relative">
              <div className="h-28 overflow-hidden"><ProductImage category={i.category} name={i.name} image={i.image} size="sm" className="rounded-none" /></div>
              {inCart > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">{inCart} in cart</span>}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2.5">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{i.name}</p>
              {i.variantName && <p className="truncate text-xs text-ink-muted">{i.variantName}</p>}
              <p className="mt-auto pt-1 text-[15px] font-bold text-ink">{kes(one?.unit_price ?? i.retail)}</p>
              {bulk && <p className="text-[11px] text-teal-fg">{bulk.min_qty}+: {kes(bulk.unit_price)} each</p>}
              <span className={cx("mt-1 w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold", i.available <= 0 ? "bg-rose-bg text-rose-fg" : i.low ? "bg-amber-bg text-amber-fg" : "bg-mint-bg text-mint-fg")}>
                {i.available <= 0 ? "Out of stock" : `${i.low ? "Low" : "In Stock"} (${i.available})`}{!online && " · last known"}
              </span>
              <button onClick={() => onAdd(i)} disabled={left <= 0}
                className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:border-line disabled:text-ink-muted">
                <Plus className="size-4" /> {left <= 0 && i.available > 0 ? "All in cart" : "Add"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Choose the exact variant (its own SKU and stock record) by colour, shade, length and size. */
function VariantPicker({ variants, sheet, qtyOf, onClose, onAdd }: {
  variants: PosItem[]; sheet: Sheet | undefined; qtyOf: (id: string) => number; onClose: () => void; onAdd: (v: PosItem) => void;
}) {
  const p = variants[0];
  // Only attributes that actually differ between this product's variants.
  const attrs = ATTRS.filter(([a]) => new Set(variants.map((v) => v[a] ?? "")).size > 1);
  const [chosen, setChosen] = useState<Partial<Record<Attr, string>>>(() => {
    const first = variants.find((v) => v.available > 0) ?? variants[0];
    return Object.fromEntries(attrs.map(([a]) => [a, first[a] ?? ""]));
  });
  const fits = (v: PosItem, except?: Attr) => attrs.every(([a]) => a === except || (v[a] ?? "") === (chosen[a] ?? ""));
  const picked = attrs.length ? variants.find((v) => fits(v)) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-20" role="dialog" aria-modal="true" aria-label={`Choose ${p.name}`} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="size-16 shrink-0"><ProductImage category={p.category} name={p.name} image={p.image} size="sm" className="rounded-xl" /></span>
          <div className="min-w-0 flex-1"><p className="text-lg font-bold">{p.name}</p>{p.brand && <p className="text-sm text-ink-muted">{p.brand}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="p-1"><X className="size-5" /></button>
        </div>

        {attrs.length ? attrs.map(([a, label]) => (
          <fieldset key={a} className="mt-4">
            <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
            <div className="flex flex-wrap gap-2">
              {uniq(variants.map((v) => v[a])).map((value) => {
                const exists = variants.some((v) => (v[a] ?? "") === value && fits(v, a));
                const active = chosen[a] === value;
                return (
                  <button key={value} type="button" onClick={() => setChosen((c) => ({ ...c, [a]: value }))} aria-pressed={active}
                    className={cx("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40",
                      !exists && !active && "opacity-40")}>
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )) : (
          <ul className="mt-4 divide-y divide-line">
            {variants.map((v) => (
              <li key={v.variantId}><button onClick={() => v.available - qtyOf(v.variantId) > 0 && onAdd(v)} disabled={v.available - qtyOf(v.variantId) <= 0}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:opacity-40">
                <span><span className="font-semibold">{v.variantName ?? v.sku}</span><span className="block text-xs text-ink-muted">SKU {v.sku} · {v.available} in stock</span></span>
                <span className="font-bold">{kes(breakFor(sheet?.[v.variantId], 1)?.unit_price ?? v.retail)}</span>
              </button></li>
            ))}
          </ul>
        )}

        {attrs.length > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-surface p-3">
            {picked ? (
              <span className="text-sm"><span className="block font-semibold">{kes(breakFor(sheet?.[picked.variantId], 1)?.unit_price ?? picked.retail)}</span>
                <span className="text-ink-muted">SKU {picked.sku} · {picked.available <= 0 ? "Out of stock" : `${picked.available} in stock`}</span></span>
            ) : <span className="text-sm text-ink-muted">That combination isn&apos;t stocked.</span>}
            <Button onClick={() => picked && onAdd(picked)} disabled={!picked || picked.available - qtyOf(picked.variantId) <= 0}><Check className="size-4" /> Add to Cart</Button>
          </div>
        )}
      </div>
    </div>
  );
}
