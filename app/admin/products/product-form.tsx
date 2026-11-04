"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, ChevronRight, Eye, EyeOff, FileText, Image as ImageIcon, Info, Layers, LayoutTemplate, Package, Plus, Search, Tag, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, cx, inputClass } from "@/components/ui";
import { PhotoManager } from "@/components/admin/photo-manager";
import { Combobox } from "@/components/combobox";
import { stockText } from "@/components/product-result-row";
import { ProductImage } from "@/components/shop/product-image";
import { kes } from "@/lib/format";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { createProduct, updateProduct, type ProductInput } from "../actions";

// Add / Edit Product as a workspace with tabs (Nicholas, 2026-11-04; UX doctrine §2, §3, §16, §17,
// §22): Basic Details · Options & Variants · Pricing & Stock · Product Page. Tabs switch in place and
// keep every value; the tab is mirrored in the URL (replaced, so Back leaves the page rather than walking tabs).
// Validation shows by the field and opens the tab that needs attention. Leaving with unsaved changes
// asks first. admin_create_product() / admin_update_product() validate everything again.

type Category = { slug: string; name: string; parent: string | null };
export type ProductRow = ProductInput["variants"][number] & { onHand?: number };
export type ProductFormValues = Omit<ProductInput["product"], "option_type"> & { option_type: string };

const emptyRow = (): ProductRow => ({ option: "", option2: "", sku: "", barcode: "", retail: "", wholesale: "", stock: "0", reorder_level: "5", active: true });
// The option types the database functions support. Two-part types (colour + length / size) give each
// variant both values, e.g. "Natural Black · 18\"".
const OPTION_TYPES = [
  { value: "none", label: "No options", hint: "One item" },
  { value: "colour", label: "Colour", hint: "e.g. Natural Black" },
  { value: "length", label: "Length", hint: "e.g. 18\"" },
  { value: "shade", label: "Shade", hint: "e.g. 230 Natural Buff" },
  { value: "size", label: "Size / pack size", hint: "e.g. 100ml" },
  { value: "colour_length", label: "Colour + Length", hint: "e.g. Brown · 18\"" },
  { value: "colour_size", label: "Colour + Size", hint: "e.g. Rose · 50ml" },
];
/** The second part of a two-part option type, and where its values come from. */
const SECOND: Record<string, { label: string; values: string }> = { colour_length: { label: "Length", values: "length" }, colour_size: { label: "Size", values: "size" } };
const optionLabel = (kind: string, r: { option: string; option2?: string }) => (SECOND[kind] ? [r.option.trim(), (r.option2 ?? "").trim()].filter(Boolean).join(" · ") : r.option.trim());
export const EMPTY_PRODUCT: ProductFormValues = {
  name: "", category_slug: "", brand: "", description: "", images: [], is_featured: false, is_active: true,
  benefits: [], how_to_use: "", ingredients: "", option_type: "none", hair_texture: "", hair_type: "", tax_type: "B",
};

const TABS = [
  { id: "basic", label: "Basic Details", Icon: FileText },
  { id: "variants", label: "Options & Variants", Icon: Layers },
  { id: "pricing", label: "Pricing & Stock", Icon: Tag },
  { id: "page", label: "Product Page", Icon: LayoutTemplate },
] as const;
type TabId = (typeof TABS)[number]["id"];
type Errors = Partial<Record<string, string>>;
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

/** Field-level checks; keys say which tab they belong to (basic.*, variants.*, pricing.*). */
function validate(p: ProductFormValues, rows: ProductRow[]): Errors {
  const e: Errors = {};
  if (!p.name.trim()) e["basic.name"] = "Product name is required";
  if (!p.category_slug) e["basic.category"] = "Category is required";
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (p.option_type !== "none") {
      const second = SECOND[p.option_type];
      const o = optionLabel(p.option_type, r).toLowerCase();
      if (!r.option.trim()) e[`variants.${i}.option`] = second ? "Choose the colour" : "Enter the option, e.g. 18\" or Natural Black";
      else if (second && !(r.option2 ?? "").trim()) e[`variants.${i}.option2`] = `Choose the ${second.label.toLowerCase()}`;
      else if (seen.has(o)) e[`variants.${i}.option`] = "This option is already listed";
      seen.add(o);
    }
    if (r.barcode && !/^[0-9A-Za-z-]{4,32}$/.test(r.barcode.trim())) e[`variants.${i}.barcode`] = "Use 4–32 letters or digits";
    const retail = num(r.retail), wholesale = num(r.wholesale);
    if (!(retail > 0)) e[`pricing.${i}.retail`] = "Retail price is required";
    if (!(wholesale > 0)) e[`pricing.${i}.wholesale`] = "Wholesale price is required";
    else if (retail > 0 && wholesale > retail) e[`pricing.${i}.wholesale`] = "Wholesale price cannot exceed retail price";
    if (!r.id && (num(r.stock) < 0 || !Number.isInteger(num(r.stock)))) e[`pricing.${i}.stock`] = "Opening stock cannot be negative";
    if (num(r.reorder_level) < 0 || !Number.isInteger(num(r.reorder_level))) e[`pricing.${i}.reorder`] = "Reorder level cannot be negative";
  });
  return e;
}

export function ProductForm({ categories, brands, optionValues, initial = EMPTY_PRODUCT, initialRows, edit, notice }: {
  categories: Category[];
  brands: string[];
  /** Option values already used in the catalogue, by option type, for the searchable pickers. */
  optionValues: Record<string, string[]>;
  initial?: ProductFormValues;
  initialRows?: ProductRow[];
  edit?: { id: string; slug: string };
  /** Shown under the title, e.g. "Product added". */
  notice?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The open tab: local state (switches instantly), mirrored into ?tab= so a refresh or link reopens it.
  const [tab, setTab] = useState<TabId>(() => (TABS.find((t) => t.id === params.get("tab"))?.id ?? "basic") as TabId);
  const [p, setP] = useState(initial);
  const [rows, setRows] = useState<ProductRow[]>(initialRows ?? [emptyRow()]);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [baseline, setBaseline] = useState(() => JSON.stringify([initial, initialRows ?? [emptyRow()]]));
  const [variantQuery, setVariantQuery] = useState("");
  const [previewRow, setPreviewRow] = useState(0);
  const leaving = useRef(false);

  const parents = categories.filter((c) => !c.parent);
  const categoryOptions = parents.flatMap((c) => {
    const kids = categories.filter((k) => k.parent === c.slug);
    return kids.length ? kids.map((k) => ({ value: k.slug, label: k.name, hint: c.name })) : [{ value: c.slug, label: c.name }];
  });
  const isHair = categories.find((c) => c.slug === p.category_slug)?.parent === "hair" || p.category_slug === "hair";
  const set = (patch: Partial<ProductFormValues>) => { setP((v) => ({ ...v, ...patch })); setSaved(false); };
  const setRow = (i: number, patch: Partial<ProductRow>) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); setSaved(false); };
  const existing = rows.filter((r) => r.id).length;
  const benefits = [0, 1, 2].map((i) => p.benefits[i] ?? "");
  const errors = useMemo(() => validate(p, rows), [p, rows]);
  // Messages show after the first Save attempt; wholesale above retail shows as soon as it's typed.
  const err = (key: string) => (tried || /exceed/.test(errors[key] ?? "") ? errors[key] : undefined);
  const tabErrors = (id: TabId) => Object.keys(errors).some((k) => k.startsWith(`${id}.`));
  const dirty = JSON.stringify([p, rows]) !== baseline;

  function goTab(id: TabId) {
    setTab(id);
    const next = new URLSearchParams(window.location.search);
    if (id === "basic") next.delete("tab"); else next.set("tab", id);
    window.history.replaceState(window.history.state, "", `${pathname}${next.size ? `?${next}` : ""}`);
  }

  // Unsaved work: the browser asks before closing or reloading; in-app links ask first (doctrine §13).
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { if (!leaving.current) { e.preventDefault(); e.returnValue = ""; } };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a || leaving.current || a.target === "_blank" || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith(`${pathname}?`) || href === pathname) return;
      if (!window.confirm("Leave without saving? Your changes to this product will be lost.")) { e.preventDefault(); e.stopPropagation(); }
      else leaving.current = true;
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty, pathname]);

  function discard() {
    if (dirty && !window.confirm("Discard your changes to this product?")) return;
    leaving.current = true;
    if (edit) { setP(initial); setRows(initialRows ?? [emptyRow()]); setTried(false); leaving.current = false; }
    else router.push("/admin/products");
  }

  function save() {
    setTried(true); setServerError(null);
    const first = Object.keys(errors)[0];
    if (first) { goTab(first.split(".")[0] as TabId); return; }
    const product = { ...p, benefits: p.benefits.map((b) => b.trim()).filter(Boolean), hair_texture: isHair ? p.hair_texture : "", hair_type: isHair ? p.hair_type : "" };
    const variants = (p.option_type === "none" ? rows.slice(0, Math.max(1, existing)) : rows)
      .map(({ onHand: _onHand, ...r }) => ({ ...r, option: p.option_type === "none" ? "" : r.option }));
    start(async () => {
      if (edit) {
        const res = await updateProduct(edit.id, { product, variants }, initial.images);
        if (!res.ok) return setServerError(res.error);
        setSaved(true); setTried(false);
        setBaseline(JSON.stringify([p, rows]));
        router.refresh();
      } else {
        const res = await createProduct({ product, variants });
        if (!res.ok) return setServerError(res.error);
        leaving.current = true;
        router.push(`/admin/products/${res.data.id}/edit?created=1`);
      }
    });
  }

  const visibleRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => !variantQuery.trim() || `${r.option} ${r.sku}`.toLowerCase().includes(variantQuery.trim().toLowerCase()));
  const label = (r: ProductRow, i: number) => (p.option_type === "none" ? "Single item" : optionLabel(p.option_type, r) || `Option ${i + 1}`);
  const pr = rows[Math.min(previewRow, rows.length - 1)] ?? rows[0];
  const previewStock = pr ? (pr.id ? pr.onHand ?? 0 : Math.max(0, num(pr.stock) || 0)) : 0;
  const stock = stockText(previewStock, previewStock > 0 && previewStock <= (num(pr?.reorder_level ?? "0") || 0));

  const preview = (
    <Card className="p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Eye className="size-4 text-ink-muted" /> Quick Preview</p>
      <div className="flex gap-3">
        <span className="size-20 shrink-0"><ProductImage category={p.category_slug || "hair"} name={p.name || "Product"} image={p.images[0]} size="sm" className="rounded-lg" /></span>
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold leading-snug">{p.name || <span className="text-ink-muted">Product name</span>}</p>
          {p.brand && <p className="text-sm text-ink-muted">{p.brand}</p>}
          {p.option_type !== "none" && pr?.option && <p className="text-sm">{optionLabel(p.option_type, pr)}</p>}
          <p className="mt-1 text-lg font-bold text-brand-700 tabular-nums">{num(pr?.retail ?? "") > 0 ? kes(num(pr!.retail)) : "KES –"}</p>
          <p className={cx("text-xs font-medium", stock.className)}>{stock.text}</p>
        </div>
      </div>
      {rows.length > 1 && (
        <label className="mt-3 block text-xs text-ink-muted">Preview option
          <select value={previewRow} onChange={(e) => setPreviewRow(Number(e.target.value))} className={cx(inputClass, "mt-1 h-9 text-sm")}>
            {rows.map((r, i) => <option key={i} value={i}>{label(r, i)}</option>)}
          </select>
        </label>
      )}
      <p className="mt-3 text-xs text-ink-muted">Preview only. The shop shows what&apos;s saved.</p>
    </Card>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5" noValidate>
      {/* Header: breadcrumb, title, and the one Save (kept in view while scrolling). */}
      <div className="z-20 -mx-4 -mt-6 bg-surface/95 lg:sticky lg:top-[69px] px-4 pb-3 pt-4 backdrop-blur lg:-mx-8 lg:px-8">
        <nav className="flex items-center gap-1 text-sm text-ink-muted" aria-label="Breadcrumb">
          <Link href="/admin/products" className="hover:text-ink">Products</Link><ChevronRight className="size-4" />
          <span className="text-ink">{edit ? initial.name : "Add Product"}</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Package className="size-6" /></span>
            <div>
              <h1 className="text-2xl font-bold">{edit ? `Edit ${initial.name}` : "Add Product"}</h1>
              <p className="text-sm text-ink-muted">{edit ? "Changes show in the shop, POS and inventory as soon as you save." : "Create a new product with its details, photos, pricing and stock."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notice}
            {dirty && !pending && <span className="text-xs text-ink-muted">Unsaved changes</span>}
            <Button type="button" variant="ghost" className="border border-line bg-white" onClick={discard}>Discard</Button>
            <Button type="submit" disabled={pending}><Check className="size-4" /> {pending ? "Saving…" : edit ? "Save Changes" : "Save Product"}</Button>
          </div>
        </div>
        {(serverError || (tried && Object.keys(errors).length > 0)) && (
          <p className="mt-2 rounded-lg bg-rose-bg px-3 py-2 text-sm text-rose-fg" role="alert">{serverError ?? "Please fix the highlighted fields."}</p>
        )}
        {saved && !dirty && <p className="mt-2 rounded-lg bg-mint-bg px-3 py-2 text-sm text-mint-fg" role="status">Saved. The shop, POS and inventory show the changes now.</p>}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product sections">
          {TABS.map(({ id, label: l, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => goTab(id)}
              className={cx("flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition",
                tab === id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:border-ink/30")}>
              <Icon className="size-4" />{l}
              {tried && tabErrors(id) && <span className={cx("size-2 rounded-full", tab === id ? "bg-white" : "bg-rose-fg")} aria-label="needs attention" />}
            </button>
          ))}
        </div>
      </div>

      <div className={cx("grid gap-5", (tab === "basic" || tab === "page") && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="min-w-0 space-y-5">
          {tab === "basic" && (
            <Card className="p-5">
              <p className="mb-4 flex items-center gap-2 font-semibold"><Info className="size-4 text-brand-600" /> Product Information</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Product name *">
                    <input value={p.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!err("basic.name")} className={cx(inputClass, err("basic.name") && "border-rose-fg")} placeholder="e.g. Body Wave Lace Front Wig" />
                  </Field>
                  {err("basic.name") && <p className="mt-1 text-xs text-rose-fg">{err("basic.name")}</p>}
                </div>
                <Combobox variant="form" label="Category" required value={p.category_slug} onChange={(v) => set({ category_slug: v })} allLabel="Select category" options={categoryOptions} error={err("basic.category")} />
                <Combobox variant="form" label="Brand / Supplier" value={p.brand} onChange={(v) => set({ brand: v })} allLabel="Select or type brand" allowCustom
                  options={brands.map((b) => ({ value: b, label: b }))} />
                <div className="sm:col-span-2"><Field label="Description"><textarea value={p.description} onChange={(e) => set({ description: e.target.value })} rows={4} className={cx(inputClass, "h-auto py-3")} placeholder="Write a short, clear description…" /></Field></div>
                {isHair && (
                  <>
                    <Field label="Texture (optional)"><input value={p.hair_texture} onChange={(e) => set({ hair_texture: e.target.value })} className={inputClass} placeholder="e.g. Body Wave" /></Field>
                    <Field label="Hair type (optional)"><input value={p.hair_type} onChange={(e) => set({ hair_type: e.target.value })} className={inputClass} placeholder="e.g. 100% Human Hair" /></Field>
                  </>
                )}
                <Field label="VAT (KRA tax type)" hint="Standard-rated goods are VAT 16%. Prices are entered before VAT.">
                  <select value={p.tax_type} onChange={(e) => set({ tax_type: e.target.value as TaxType })} className={inputClass}>
                    {(Object.keys(TAX_TYPES) as TaxType[]).map((t) => <option key={t} value={t}>{t} · {TAX_TYPES[t]}</option>)}
                  </select>
                </Field>
                <div className="space-y-2.5 self-center">
                  <label className="flex items-center gap-2.5 text-sm font-semibold">
                    <input type="checkbox" checked={p.is_featured} onChange={(e) => set({ is_featured: e.target.checked })} className="size-5 accent-brand-600" /> Feature on the homepage
                  </label>
                  {edit && (
                    <label className="flex items-center gap-2.5 text-sm font-semibold">
                      <input type="checkbox" checked={p.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="size-5 accent-brand-600" /> Visible in the shop
                    </label>
                  )}
                </div>
              </div>
            </Card>
          )}

          {tab === "variants" && (
            <Card className="p-5">
              <p className="flex items-center gap-2 font-semibold"><Layers className="size-4 text-brand-600" /> Options & Variants</p>
              <p className="mt-1 text-sm text-ink-muted">Each option is one exact sellable item (SKU), with its own price and stock.</p>
              <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Options by">
                {OPTION_TYPES.map((o) => (
                  <button key={o.value} type="button" role="radio" aria-checked={p.option_type === o.value}
                    onClick={() => { set({ option_type: o.value }); if (o.value === "none") setRows((r) => r.slice(0, Math.max(1, existing))); }}
                    className={cx("rounded-xl border px-3.5 py-2 text-left text-sm transition", p.option_type === o.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30")}>
                    <span className="block font-semibold">{o.label}</span>
                    <span className={cx("text-xs", p.option_type === o.value ? "text-white/70" : "text-ink-muted")}>{o.hint}</span>
                  </button>
                ))}
              </div>
              {rows.length > 8 && (
                <div className="relative mt-4 max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input value={variantQuery} onChange={(e) => setVariantQuery(e.target.value)} placeholder="Find an option or SKU" className={cx(inputClass, "h-10 pl-9 text-sm")} />
                </div>
              )}
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs text-ink-muted"><tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    {p.option_type !== "none" && <th className="px-3 py-2 font-medium">{SECOND[p.option_type] ? "Colour" : OPTION_TYPES.find((o) => o.value === p.option_type)?.label}</th>}
                    {SECOND[p.option_type] && <th className="px-3 py-2 font-medium">{SECOND[p.option_type].label}</th>}
                    <th className="px-3 py-2 font-medium">SKU</th><th className="px-3 py-2 font-medium">Barcode</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {visibleRows.map(({ r, i }) => (
                      <tr key={r.id ?? `new-${i}`} className={cx("border-t border-line align-top", !r.active && "bg-surface/70")}>
                        <td className="px-3 py-2.5 text-ink-muted">{i + 1}</td>
                        {p.option_type !== "none" && (
                          <td className="min-w-48 px-3 py-2">
                            <Combobox label={SECOND[p.option_type] ? `Colour for option ${i + 1}` : `Option ${i + 1}`} hideLabel value={r.option} onChange={(v) => setRow(i, { option: v })} allowCustom allLabel="Choose or type"
                              options={(optionValues[SECOND[p.option_type] ? "colour" : p.option_type] ?? []).map((v) => ({ value: v, label: v }))} error={err(`variants.${i}.option`)} />
                          </td>
                        )}
                        {SECOND[p.option_type] && (
                          <td className="min-w-36 px-3 py-2">
                            <Combobox label={`${SECOND[p.option_type].label} for option ${i + 1}`} hideLabel value={r.option2 ?? ""} onChange={(v) => setRow(i, { option2: v })} allowCustom allLabel="Choose or type"
                              options={(optionValues[SECOND[p.option_type].values] ?? []).map((v) => ({ value: v, label: v }))} error={err(`variants.${i}.option2`)} />
                          </td>
                        )}
                        <td className="min-w-40 px-3 py-2">
                          <input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} aria-label={`SKU for ${label(r, i)}`}
                            placeholder={r.id ? undefined : "Made for you if empty"} className={cx(inputClass, "h-10 font-mono text-xs")} />
                        </td>
                        <td className="min-w-36 px-3 py-2">
                          <input value={r.barcode ?? ""} onChange={(e) => setRow(i, { barcode: e.target.value })} aria-label={`Barcode for ${label(r, i)}`} placeholder="Optional"
                            inputMode="numeric" aria-invalid={!!err(`variants.${i}.barcode`)} className={cx(inputClass, "h-10 font-mono text-xs", err(`variants.${i}.barcode`) && "border-rose-fg")} />
                          {err(`variants.${i}.barcode`) && <p className="mt-1 text-[11px] text-rose-fg">{err(`variants.${i}.barcode`)}</p>}
                        </td>
                        <td className="px-3 py-2.5">{r.id ? (r.active ? <Badge tone="mint">Active</Badge> : <Badge tone="amber">Hidden</Badge>) : <Badge tone="brand">New</Badge>}</td>
                        <td className="px-3 py-2 text-right">
                          {r.id ? (
                            <button type="button" onClick={() => setRow(i, { active: !r.active })} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink">
                              {r.active ? <><EyeOff className="size-3.5" /> Hide</> : <><Eye className="size-3.5" /> Show</>}
                            </button>
                          ) : rows.length > 1 && (
                            <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${label(r, i)}`} className="text-rose-fg"><Trash2 className="size-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {p.option_type !== "none" && rows.length < 20 && (
                <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="size-4" /> Add option</Button>
              )}
              {p.option_type !== "none" && <p className="mt-2 text-xs text-ink-muted">Up to 20 options. Options with sales can&apos;t be deleted; hide them instead.</p>}
            </Card>
          )}

          {tab === "pricing" && (
            <Card className="p-5">
              <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-brand-600" /> Pricing & Stock</p>
              <p className="mt-1 text-sm text-ink-muted">Prices in KES, before VAT. Wholesale price applies automatically at 10+ units of the same product.</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs text-ink-muted"><tr>
                    <th className="px-3 py-2 font-medium">Option</th><th className="px-3 py-2 text-right font-medium">Retail (KES) *</th><th className="px-3 py-2 text-right font-medium">Wholesale (KES) *</th>
                    <th className="px-3 py-2 text-right font-medium">{existing ? "Stock" : "Opening stock"}</th><th className="px-3 py-2 text-right font-medium">Reorder at</th>
                    <th className="px-3 py-2 font-medium">SKU / barcode</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const cell = (key: string, value: string, onChange: (v: string) => void, aria: string, step = "any") => (
                        <div className="ml-auto w-24">
                          <input type="number" min={0} step={step} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-label={aria} aria-invalid={!!err(key)}
                            className={cx(inputClass, "h-10 text-right tabular-nums", err(key) && "border-rose-fg")} />
                          {err(key) && <p className="mt-1 text-right text-[11px] leading-tight text-rose-fg">{err(key)}</p>}
                        </div>
                      );
                      return (
                        <tr key={r.id ?? `new-${i}`} className={cx("border-t border-line align-top", !r.active && "opacity-60")}>
                          <td className="px-3 py-3 font-medium">{label(r, i)}</td>
                          <td className="px-3 py-2">{cell(`pricing.${i}.retail`, r.retail, (v) => setRow(i, { retail: v }), `Retail price for ${label(r, i)}`)}</td>
                          <td className="px-3 py-2">{cell(`pricing.${i}.wholesale`, r.wholesale, (v) => setRow(i, { wholesale: v }), `Wholesale price for ${label(r, i)}`)}</td>
                          <td className="px-3 py-2 text-right">
                            {r.id ? <span className="inline-flex h-10 items-center gap-2 tabular-nums"><strong>{r.onHand ?? 0}</strong>
                              <Link href={`/admin/inventory?q=${encodeURIComponent(r.sku)}`} className="text-xs font-semibold text-brand-700">Adjust</Link></span>
                              : cell(`pricing.${i}.stock`, r.stock, (v) => setRow(i, { stock: v }), `Opening stock for ${label(r, i)}`, "1")}
                          </td>
                          <td className="px-3 py-2">{cell(`pricing.${i}.reorder`, r.reorder_level, (v) => setRow(i, { reorder_level: v }), `Reorder level for ${label(r, i)}`, "1")}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink-muted">{r.sku || "Made on save"}{r.barcode && <span className="block">{r.barcode}</span>}</td>
                          <td className="px-3 py-3">{r.active ? <Badge tone="mint">Active</Badge> : <Badge tone="amber">Hidden</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-muted">{existing ? "Stock for saved options changes through Inventory (Adjust), so every movement is recorded." : "Opening stock is recorded as the first stock movement."} SKUs and barcodes are edited in Options & Variants.</p>
            </Card>
          )}

          {tab === "page" && (
            <Card className="p-5">
              <p className="flex items-center gap-2 font-semibold"><LayoutTemplate className="size-4 text-brand-600" /> Product Page <span className="text-sm font-normal text-ink-muted">(optional)</span></p>
              <p className="mt-1 text-sm text-ink-muted">Shown in the benefit cards and the How to Use / Ingredients tabs in the shop. Leave empty to hide.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {benefits.map((b, i) => (
                  <Field key={i} label={`Benefit ${i + 1}`}>
                    <input value={b} onChange={(e) => { const next = [...benefits]; next[i] = e.target.value; set({ benefits: next }); }} className={inputClass} />
                  </Field>
                ))}
                <div className="sm:col-span-3"><Field label="How to use"><textarea value={p.how_to_use} onChange={(e) => set({ how_to_use: e.target.value })} rows={3} className={cx(inputClass, "h-auto py-3")} /></Field></div>
                <div className="sm:col-span-3"><Field label="Key ingredients"><textarea value={p.ingredients} onChange={(e) => set({ ingredients: e.target.value })} rows={3} className={cx(inputClass, "h-auto py-3")} /></Field></div>
                <label className="flex items-center gap-2.5 text-sm font-semibold sm:col-span-3">
                  <input type="checkbox" checked={p.is_featured} onChange={(e) => set({ is_featured: e.target.checked })} className="size-5 accent-brand-600" /> Feature on the homepage
                </label>
                {edit && (
                  <p className="text-sm text-ink-muted sm:col-span-3">Shop address: <span className="font-mono text-ink">/product/{edit.slug}</span> (stays the same so links keep working) ·{" "}
                    <Link href={`/product/${edit.slug}`} target="_blank" className="font-semibold text-brand-700">View in shop</Link></p>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className={cx("space-y-5", (tab === "variants" || tab === "pricing") && "hidden")}>
          {tab === "basic" && (
            <Card className="p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ImageIcon className="size-4 text-ink-muted" /> Product Media</p>
              <PhotoManager photos={p.images} onChange={(images) => set({ images })} folder={edit ? `products/${edit.slug}` : "products/new"} />
            </Card>
          )}
          {preview}
        </div>
      </div>
    </form>
  );
}
