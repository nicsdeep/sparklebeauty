"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Flame, History, Plus, ScanBarcode, Search, TriangleAlert, X, Zap } from "lucide-react";
import { Combobox, FilterChips, type ComboOption } from "@/components/combobox";
import { ProductResultRow, stockText, variantText } from "@/components/product-result-row";
import { ProductImage } from "@/components/shop/product-image";
import { cx } from "@/components/ui";
import { kes } from "@/lib/format";
import { breakFor, nextBreak, type PriceBreak } from "@/lib/pricing";
import type { PosCategory, PosItem } from "./terminal";

// The till's product area, following the UX doctrine (§22–§38): search or scan first, and every
// result and card is one exact sellable variant (SKU) with its price and stock. Nothing is listed
// until the cashier searches, filters or opens a section (Quick Picks, Recent, Fast-Moving, Low
// Stock, from real sales and stock). Filter values come from the catalogue the page loaded from the
// database and narrow each other. Search, filters and section are kept for this tab, so they're
// still there after visiting Recent Sales or a sale.

type Sheet = Record<string, PriceBreak[]>;
type Section = "quick" | "recent" | "fast" | "low";
const SECTIONS: { id: Section; label: string; Icon: typeof Zap; empty: string }[] = [
  { id: "quick", label: "Quick Picks", Icon: Zap, empty: "Best sellers of the last 90 days appear here." },
  { id: "recent", label: "Recent Products", Icon: History, empty: "Products you sell appear here." },
  { id: "fast", label: "Fast-Moving", Icon: Flame, empty: "No sales in the last 7 days yet." },
  { id: "low", label: "Low Stock", Icon: TriangleAlert, empty: "Nothing is running low." },
];
const STOCK: ComboOption[] = [{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }];
type Filters = { category: string; color: string; length: string; brand: string; stock: string };
const NO_FILTERS: Filters = { category: "", color: "", length: "", brand: "", stock: "" };
const STATE_KEY = "sparkle-pos-finder-v1";
const MAX_RESULTS = 10;

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const stockOf = (i: PosItem) => (i.available <= 0 ? "out" : i.low ? "low" : "in");
const searchText = (v: PosItem) => `${v.name} ${v.brand ?? ""} ${v.category} ${v.group} ${v.variantName ?? ""} ${v.color ?? ""} ${v.shade ?? ""} ${v.length ?? ""} ${v.size ?? ""} ${v.sku}`.toLowerCase();

export function ProductFinder({ items, categories, sheet, activity, online, searchRef, qtyOf, onAdd }: {
  items: PosItem[]; categories: PosCategory[]; sheet: Sheet | undefined;
  activity: { quick: string[]; fast: string[]; recent: string[] };
  online: boolean; searchRef: RefObject<HTMLInputElement | null>;
  qtyOf: (variantId: string) => number;
  onAdd: (item: PosItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [section, setSection] = useState<Section>("quick");
  const [restored, setRestored] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep search, filters and section for this tab (doctrine §27).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "null") as { query: string; filters: Filters; section: Section } | null;
      if (saved) { setQuery(saved.query); setFilters({ ...NO_FILTERS, ...saved.filters }); setSection(saved.section); }
    } catch { /* storage unavailable */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ query, filters, section })); } catch { /* ignore */ }
  }, [restored, query, filters, section]);

  const itemsBy = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  // Filters work together; each list only offers values that exist with the other filters applied (§24, §25).
  const match = (i: PosItem, skip?: keyof Filters) =>
    (skip === "category" || !filters.category || i.group === filters.category || i.category === filters.category)
    && (skip === "color" || !filters.color || i.color === filters.color || i.shade === filters.color)
    && (skip === "length" || !filters.length || i.length === filters.length || i.size === filters.length)
    && (skip === "brand" || !filters.brand || i.brand === filters.brand)
    && (skip === "stock" || !filters.stock || stockOf(i) === filters.stock);
  const options = {
    category: categories.filter((c) => items.some((i) => match(i, "category") && (i.group === c.slug || i.category === c.slug))).map((c) => ({ value: c.slug, label: c.name })),
    color: uniq(items.filter((i) => match(i, "color")).flatMap((i) => [i.color, i.shade])).map((v) => ({ value: v, label: v })),
    length: uniq(items.filter((i) => match(i, "length")).flatMap((i) => [i.length, i.size])).map((v) => ({ value: v, label: v })),
    brand: uniq(items.filter((i) => match(i, "brand")).map((i) => i.brand)).map((v) => ({ value: v, label: v })),
  };
  const filtering = Object.values(filters).some(Boolean);
  const set = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const chips = ([
    ["category", filters.category && categoryName(filters.category)], ["color", filters.color], ["length", filters.length],
    ["brand", filters.brand], ["stock", STOCK.find((s) => s.value === filters.stock)?.label],
  ] as [keyof Filters, string | undefined][]).filter(([, label]) => label).map(([key, label]) => ({ key, label: label!, onRemove: () => set(key, "") }));

  // Type-ahead: one row per exact variant whose name, brand, category, attributes or SKU match every
  // word typed, within the active filters; names starting with the text come first (§26, §34).
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return [];
    const hits = items.filter((v) => match(v) && words.every((w) => searchText(v).includes(w)));
    const first = words[0];
    return hits.sort((a, b) => Number(!a.name.toLowerCase().startsWith(first)) - Number(!b.name.toLowerCase().startsWith(first))
      || Number(a.available <= 0) - Number(b.available <= 0) || a.name.localeCompare(b.name)).slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, items, filters]);
  const filtered = useMemo(() => (filtering && !words.length ? items.filter((i) => match(i)).slice(0, 60) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filters, filtering, query]);

  useEffect(() => { setActive(0); }, [query, filters]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);

  const left = (i: PosItem) => i.available - qtyOf(i.variantId);
  function add(i: PosItem) {
    if (left(i) <= 0) return;
    onAdd(i);
    setQuery(""); setOpen(false);
    searchRef.current?.focus();
  }

  // Arrow keys move through the results; Enter adds the highlighted one, or an exact SKU/barcode
  // straight away (a scanner types the code and presses Enter); Escape closes the list.
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const code = query.trim().toLowerCase();
      const exact = items.find((i) => i.sku.toLowerCase() === code);
      const pick = exact ?? results[active];
      if (pick) add(pick);
    }
  }

  const sectionIds: Record<Section, string[]> = {
    quick: activity.quick, recent: activity.recent, fast: activity.fast,
    low: items.filter((i) => i.low && i.available > 0).sort((a, b) => a.available - b.available).slice(0, 12).map((i) => i.variantId),
  };
  const sectionItems = sectionIds[section].map((id) => itemsBy.get(id)).filter((x): x is PosItem => !!x);
  const meta = (i: PosItem) => [categoryName(i.category), i.brand].filter(Boolean).join(" · ");
  const showList = open && words.length > 0;

  return (
    <div className="space-y-4">
      <div ref={boxRef} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
        <input ref={searchRef} autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          className="h-13 w-full rounded-2xl border border-line bg-white pl-12 pr-20 text-base shadow-sm focus:border-ink/40 focus:outline-none"
          placeholder="Search product, SKU, barcode, brand or supplier…" aria-label="Search products or scan barcode" autoComplete="off"
          role="combobox" aria-expanded={showList} aria-controls="pos-results" aria-activedescendant={showList && results[active] ? `pos-result-${active}` : undefined} />
        <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-ink-muted">
          {query && <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search"><X className="size-5" /></button>}
          <ScanBarcode className="size-5" aria-hidden />
        </span>
        {showList && (
          <div className="absolute z-30 mt-1.5 w-full rounded-2xl border border-line bg-white p-1.5 shadow-xl">
            {results.length ? (
              <ul id="pos-results" ref={listRef} role="listbox" aria-label="Matching products" className="max-h-[min(28rem,60vh)] overflow-y-auto">
                {results.map((i, n) => (
                  <li key={i.variantId} id={`pos-result-${n}`} data-index={n} role="option" aria-selected={n === active} aria-disabled={left(i) <= 0}>
                    <button type="button" onClick={() => add(i)} onMouseEnter={() => setActive(n)} disabled={left(i) <= 0} className="block w-full">
                      <ProductResultRow image={i.image} category={i.category} name={i.name} variant={variantText(i)} meta={meta(i)} sku={i.sku}
                        price={breakFor(sheet?.[i.variantId], 1)?.unit_price ?? i.retail} available={i.available} low={i.low} active={n === active} lastKnown={!online} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center" role="status">
                <p className="text-sm">No products found for “{query.trim()}”{filtering ? " with these filters" : ""}.</p>
                <div className="mt-3 flex justify-center gap-2">
                  {filtering && <button type="button" onClick={() => setFilters(NO_FILTERS)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold">Clear filters</button>}
                  <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold">Try another search</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Combobox label="Category" value={filters.category} options={options.category} onChange={(v) => set("category", v)} allLabel="All categories" />
        <Combobox label="Color" value={filters.color} options={options.color} onChange={(v) => set("color", v)} allLabel="All colours" />
        <Combobox label="Size / Length" value={filters.length} options={options.length} onChange={(v) => set("length", v)} allLabel="All sizes" />
        <Combobox label="Brand / Supplier" value={filters.brand} options={options.brand} onChange={(v) => set("brand", v)} allLabel="All brands" />
        <Combobox label="Stock" value={filters.stock} options={STOCK} onChange={(v) => set("stock", v)} allLabel="All stock" />
      </div>
      <FilterChips chips={chips} onClearAll={() => setFilters(NO_FILTERS)} />

      {filtering && !words.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold">{filtered.length === 60 ? "First 60 matches" : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}</p>
          <ProductGrid list={filtered} sheet={sheet} online={online} qtyOf={qtyOf} onAdd={add} categoryName={categoryName}
            empty={<>No products match these filters. <button onClick={() => setFilters(NO_FILTERS)} className="font-semibold text-brand-700">Clear filters</button></>} />
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
          <ProductGrid list={sectionItems} sheet={sheet} online={online} qtyOf={qtyOf} onAdd={add} categoryName={categoryName} empty={SECTIONS.find((s) => s.id === section)!.empty} />
        </div>
      )}
    </div>
  );
}

/**
 * Operational cards, one per exact SKU (§29–§32): name, variant, SKU, price, the wholesale break,
 * compact stock text and one Add. White, subtle border, pink only for the price and Add.
 */
function ProductGrid({ list, sheet, online, qtyOf, onAdd, categoryName, empty }: {
  list: PosItem[]; sheet: Sheet | undefined; online: boolean; qtyOf: (id: string) => number; onAdd: (i: PosItem) => void;
  categoryName: (slug: string) => string; empty: React.ReactNode;
}) {
  if (!list.length) return <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {list.map((i) => {
        const inCart = qtyOf(i.variantId);
        const left = i.available - inCart;
        const price = breakFor(sheet?.[i.variantId], 1)?.unit_price ?? i.retail;
        const bulk = nextBreak(sheet?.[i.variantId], 1);
        const stock = stockText(i.available, i.low);
        const variant = variantText(i);
        return (
          <article key={i.variantId} className="flex flex-col rounded-lg border border-line bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,56,0.04)]">
            <div className="flex items-start gap-2.5">
              <span className="size-12 shrink-0"><ProductImage category={i.category} name={i.name} image={i.image} size="sm" className="rounded-md" /></span>
              <div className="min-w-0 text-right">
                <p className="text-[15px] font-bold text-brand-700 tabular-nums">{kes(price)}</p>
                <p className={cx("text-xs font-medium", stock.className)}>{stock.text}{!online && i.available > 0 ? " (last known)" : ""}</p>
                {inCart > 0 && <p className="text-xs text-ink-muted">{inCart} in cart</p>}
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug" title={i.name}>{i.name}</p>
            <p className="text-xs font-medium text-ink">{variant || categoryName(i.category)}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">SKU {i.sku}</p>
            {bulk && <p className="mt-0.5 text-[11px] text-ink-muted">Wholesale: {bulk.min_qty}+ → {kes(bulk.unit_price)} each</p>}
            <span className="h-2" aria-hidden />
            <button onClick={() => onAdd(i)} disabled={left <= 0}
              className="mt-auto flex h-8 items-center justify-center gap-1 rounded-md border border-brand-200 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:border-line disabled:text-ink-muted">
              <Plus className="size-4" /> {left <= 0 && i.available > 0 ? "All in cart" : "Add"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
