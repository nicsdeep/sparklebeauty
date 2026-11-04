"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, ChevronDown, Ellipsis, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Combobox, FilterChips } from "@/components/combobox";
import { Sheet } from "@/components/sheet";
import { Button, cx } from "@/components/ui";
import { FILTER_KEYS, filterLabel, type Facets, type FilterKey } from "@/lib/shop-filters";

export type ShopCategory = { slug: string; name: string; children: { slug: string; name: string }[] };

// Every filter lives in the URL (?category=&brand=&color=…), so Back, refresh and shared links
// keep the view (UX doctrine §3, §27). Changing a filter replaces the URL without scrolling.
// `latest` is the last URL asked for: a second tap while the first is still loading builds on it,
// so quick taps (colour, then length) don't undo each other.
let latest: string | null = null;
let latestAt = 0;
function useShopParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  useEffect(() => { if (latest === params.toString()) latest = null; }, [params]);
  const set = (patch: Record<string, string | null>) => {
    // Ignore an old request (e.g. the customer has since followed a link to other filters).
    const base = latest !== null && Date.now() - latestAt < 8000 ? latest : params.toString();
    const next = new URLSearchParams(base);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete("page");
    latest = next.toString();
    latestAt = Date.now();
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

const SORTS = [
  { value: "", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
];

/** "Sort: Featured", a compact native dropdown (works well with touch). */
export function SortMenu() {
  const { params, set, pending } = useShopParams();
  const value = params.get("sort") ?? "";
  return (
    <label className="relative flex h-11 min-w-0 items-center rounded-full border border-line bg-white pl-4 pr-9 text-[15px] focus-within:border-brand-500">
      <span className="whitespace-nowrap text-ink-muted">Sort:&nbsp;</span>
      <span className="truncate font-semibold">{SORTS.find((s) => s.value === value)?.label ?? "Featured"}</span>
      <select value={value} onChange={(e) => set({ sort: e.target.value || null })} aria-label="Sort products"
        className="absolute inset-0 cursor-pointer opacity-0">
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {pending ? <Loader2 className="pointer-events-none absolute right-3.5 size-4 animate-spin text-ink-muted" aria-label="Sorting" />
        : <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-ink-muted" aria-hidden />}
    </label>
  );
}

function activeCount(params: URLSearchParams) {
  return FILTER_KEYS.filter((k) => params.get(k) && !(k === "max" && params.get("min"))).length;
}

/** The Filter button (below `lg`) and its bottom sheet. */
export function FilterButton({ categories, facets, total }: { categories: ShopCategory[]; facets: Facets; total: number }) {
  const [open, setOpen] = useState(false);
  const { params, set, pending } = useShopParams();
  const n = activeCount(params);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-brand-200 bg-brand-50/60 px-5 text-[15px] font-semibold text-brand-700 lg:hidden">
        <SlidersHorizontal className="size-[18px]" aria-hidden /> Filter
        {n > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-xs text-white">{n}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="flex-1" disabled={!n} onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>Clear all</Button>
            <Button className="flex-[1.6]" onClick={() => setOpen(false)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : `Show ${total} product${total === 1 ? "" : "s"}`}
            </Button>
          </div>
        }>
        <FilterPanel categories={categories} facets={facets} />
      </Sheet>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-line py-4 first:pt-0 last:border-0"><h3 className="mb-2.5 text-sm font-semibold">{title}</h3>{children}</section>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cx("rounded-full border px-3.5 py-2 text-sm font-medium transition", active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white hover:border-ink/30")}>
      {children}
    </button>
  );
}

/** Values as tap chips, or a searchable list when there are many (UX doctrine §22). */
function ValuePicker({ label, param, values }: { label: string; param: string; values: string[] }) {
  const { params, set } = useShopParams();
  const value = params.get(param) ?? "";
  if (values.length > 10) {
    return <Combobox label={label} hideLabel value={value} options={values.map((v) => ({ value: v, label: v }))} allLabel={`All ${label.toLowerCase()}s`} onChange={(v) => set({ [param]: v || null })} />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => <Chip key={v} active={value === v} onClick={() => set({ [param]: value === v ? null : v })}>{v}</Chip>)}
    </div>
  );
}

function PriceInputs({ range }: { range: [number, number] }) {
  const { params, set } = useShopParams();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  useEffect(() => { setMin(params.get("min") ?? ""); setMax(params.get("max") ?? ""); }, [params]);
  const apply = () => set({ min: Number(min) > 0 ? String(Math.round(Number(min))) : null, max: Number(max) > 0 ? String(Math.round(Number(max))) : null });
  const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-brand-500";
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); apply(); }}>
      <label className="min-w-0 flex-1"><span className="sr-only">Minimum price</span>
        <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} onBlur={apply} placeholder={range[0].toLocaleString("en-KE")} className={input} /></label>
      <span className="text-ink-muted">–</span>
      <label className="min-w-0 flex-1"><span className="sr-only">Maximum price</span>
        <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} onBlur={apply} placeholder={range[1].toLocaleString("en-KE")} className={input} /></label>
      <button type="submit" className="sr-only">Apply price</button>
    </form>
  );
}

/** All filters: in the bottom sheet on phones and tablets, in the sidebar on desktop. */
export function FilterPanel({ categories, facets }: { categories: ShopCategory[]; facets: Facets }) {
  const { params, set } = useShopParams();
  const category = params.get("category") ?? "";
  const brand = params.get("brand") ?? "";
  const row = (slug: string, name: string, indent = false) => (
    <li key={slug || "all"}>
      <button type="button" onClick={() => set({ category: slug || null, color: null, length: null, size: null })} aria-pressed={category === slug}
        className={cx("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[15px]", indent && "pl-6",
          category === slug ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-surface")}>
        {name}{category === slug && <Check className="size-4" aria-hidden />}
      </button>
    </li>
  );
  const parent = categories.find((c) => c.slug === category || c.children.some((ch) => ch.slug === category));
  return (
    <div>
      <Section title="Category">
        <ul className="-mx-2.5 space-y-0.5">
          {row("", "All products")}
          {categories.map((c) => [row(c.slug, c.name), ...(parent?.slug === c.slug ? c.children.map((ch) => row(ch.slug, ch.name, true)) : [])])}
        </ul>
      </Section>
      {facets.brands.length > 0 && (
        <Section title="Brand">
          <Combobox label="Brand" hideLabel value={brand} allLabel="All brands" onChange={(v) => set({ brand: v || null })}
            options={facets.brands.map((b) => ({ value: b.value, label: b.value, hint: String(b.count) }))} />
        </Section>
      )}
      <Section title="Price (KES)"><PriceInputs range={facets.priceRange} /></Section>
      {facets.colors.length > 0 && <Section title="Colour / shade"><ValuePicker label="Colour" param="color" values={facets.colors} /></Section>}
      {facets.lengths.length > 0 && <Section title="Length"><ValuePicker label="Length" param="length" values={facets.lengths} /></Section>}
      {facets.sizes.length > 0 && <Section title="Size"><ValuePicker label="Size" param="size" values={facets.sizes} /></Section>}
      <Section title="Availability">
        <div className="flex flex-wrap gap-2">
          <Chip active={params.get("stock") === "in"} onClick={() => set({ stock: params.get("stock") === "in" ? null : "in" })}>In stock</Chip>
          <Chip active={params.get("offers") === "1"} onClick={() => set({ offers: params.get("offers") === "1" ? null : "1" })}>On offer</Chip>
        </div>
      </Section>
    </div>
  );
}

/** Active filters as chips: `Wigs ×` `Brown ×` `18" ×`, plus Clear all (UX doctrine §28). */
export function ActiveFilters({ categoryNames }: { categoryNames: Record<string, string> }) {
  const { params, set } = useShopParams();
  const chips = FILTER_KEYS.filter((k) => params.get(k)).map((k: FilterKey) => {
    const v = params.get(k)!;
    return { key: k, label: filterLabel(k, v, categoryNames[v]), onRemove: () => set({ [k]: null }) };
  });
  if (params.get("q")) chips.unshift({ key: "q", label: `“${params.get("q")}”`, onRemove: () => set({ q: null }) } as never);
  return <FilterChips chips={chips} onClearAll={() => set(Object.fromEntries([...FILTER_KEYS, "q"].map((k) => [k, null])))} />;
}

/** "See All" brands: a searchable list in a sheet. */
export function BrandSheet({ brands }: { brands: { value: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { params, set } = useShopParams();
  const shown = brands.filter((b) => b.value.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[15px] font-semibold text-brand-700">See All <ArrowRight className="size-4" aria-hidden /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="All brands">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands" aria-label="Search brands" autoComplete="off"
            className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[15px] outline-none focus:border-brand-500 focus:bg-white" />
        </div>
        <ul className="-mx-2 mt-3">
          {shown.map((b) => (
            <li key={b.value}>
              <button type="button" onClick={() => { set({ brand: params.get("brand") === b.value ? null : b.value }); setOpen(false); }}
                className={cx("flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[15px]", params.get("brand") === b.value ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-surface")}>
                {b.value}<span className="text-sm text-ink-muted">{b.count}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-3 py-6 text-center text-ink-muted">No brand matches “{q.trim()}”.</li>}
        </ul>
      </Sheet>
    </>
  );
}

/** "More" categories tile and its sheet. */
export function MoreCategories({ categories }: { categories: ShopCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[88px]">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100 sm:size-16"><Ellipsis className="size-6" aria-hidden /></span>
        <span className="text-[13px] font-medium leading-tight sm:text-sm">More</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="All categories">
        <ul className="space-y-4">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/shop?category=${c.slug}`} onClick={() => setOpen(false)} className="font-semibold hover:text-brand-700">{c.name}</Link>
              {c.children.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.children.map((ch) => (
                    <Link key={ch.slug} href={`/shop?category=${ch.slug}`} onClick={() => setOpen(false)}
                      className="rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-brand-200 hover:text-brand-700">{ch.name}</Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
