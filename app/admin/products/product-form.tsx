"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, cx, inputClass } from "@/components/ui";
import { PhotoManager } from "@/components/admin/photo-manager";
import { TAX_TYPES, type TaxType } from "@/lib/tax";
import { createProduct, updateProduct, type ProductInput } from "../actions";

type Category = { slug: string; name: string; parent: string | null };
export type ProductRow = ProductInput["variants"][number] & { onHand?: number };
export type ProductFormValues = Omit<ProductInput["product"], "option_type"> & { option_type: string };

const emptyRow = (): ProductRow => ({ option: "", sku: "", retail: "", wholesale: "", stock: "0", reorder_level: "5", active: true });
const OPTION_TYPES = [
  { value: "none", label: "No options (one item)" },
  { value: "length", label: "Length (e.g. 18\")" },
  { value: "colour", label: "Colour" },
  { value: "shade", label: "Shade" },
  { value: "size", label: "Size (e.g. 100ml)" },
];
export const EMPTY_PRODUCT: ProductFormValues = {
  name: "", category_slug: "", brand: "", description: "", images: [], is_featured: false, is_active: true,
  benefits: [], how_to_use: "", ingredients: "", option_type: "none", hair_texture: "", hair_type: "", tax_type: "B",
};

/**
 * Add or edit a product: details, photos, options with retail/wholesale prices, and product-page
 * details. Opening stock is set only for new options; later stock changes go through Inventory.
 * admin_create_product() / admin_update_product() validate everything again.
 */
export function ProductForm({ categories, brands, initial = EMPTY_PRODUCT, initialRows, edit }: {
  categories: Category[];
  brands: string[];
  initial?: ProductFormValues;
  initialRows?: ProductRow[];
  edit?: { id: string; slug: string };
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [rows, setRows] = useState<ProductRow[]>(initialRows ?? [emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const parents = categories.filter((c) => !c.parent);
  const isHair = categories.find((c) => c.slug === p.category_slug)?.parent === "hair" || p.category_slug === "hair";
  const set = (patch: Partial<ProductFormValues>) => { setP((v) => ({ ...v, ...patch })); setSaved(false); };
  const setRow = (i: number, patch: Partial<ProductRow>) => { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); setSaved(false); };
  const existing = rows.filter((r) => r.id).length;
  const benefits = [0, 1, 2].map((i) => p.benefits[i] ?? "");

  function submit() {
    setError(null);
    const product = { ...p, benefits: p.benefits.map((b) => b.trim()).filter(Boolean), hair_texture: isHair ? p.hair_texture : "", hair_type: isHair ? p.hair_type : "" };
    const variants = (p.option_type === "none" ? rows.slice(0, Math.max(1, existing)) : rows)
      .map(({ onHand: _onHand, ...r }) => ({ ...r, option: p.option_type === "none" ? "" : r.option }));
    start(async () => {
      if (edit) {
        const res = await updateProduct(edit.id, { product, variants }, initial.images);
        if (!res.ok) return setError(res.error);
        setSaved(true);
        router.refresh();
      } else {
        const res = await createProduct({ product, variants });
        if (!res.ok) return setError(res.error);
        router.push(`/admin/products/${res.data.id}/edit?created=1`);
      }
    });
  }

  return (
    <form action={submit} className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader title="Product details" action={edit && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={p.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="size-5 accent-brand-600" />
            Visible in the shop
          </label>
        )} />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Product name"><input value={p.name} onChange={(e) => set({ name: e.target.value })} required className={inputClass} placeholder="e.g. Body Wave Lace Front Wig" /></Field></div>
          <Field label="Category">
            <select value={p.category_slug} onChange={(e) => set({ category_slug: e.target.value })} required className={inputClass}>
              <option value="" disabled>Choose a category</option>
              {parents.map((c) => {
                const kids = categories.filter((k) => k.parent === c.slug);
                return kids.length ? (
                  <optgroup key={c.slug} label={c.name}>{kids.map((k) => <option key={k.slug} value={k.slug}>{k.name}</option>)}</optgroup>
                ) : <option key={c.slug} value={c.slug}>{c.name}</option>;
              })}
            </select>
          </Field>
          <Field label="Brand" hint="Pick one or type a new brand.">
            <input value={p.brand} onChange={(e) => set({ brand: e.target.value })} list="brand-list" className={inputClass} autoComplete="off" />
            <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea value={p.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={cx(inputClass, "h-auto py-3")} /></Field></div>
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
          <label className="flex items-center gap-2.5 text-[15px] font-semibold sm:col-span-2">
            <input type="checkbox" checked={p.is_featured} onChange={(e) => set({ is_featured: e.target.checked })} className="size-5 accent-brand-600" /> Feature on the homepage
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Photos" subtitle="Shown in the shop gallery. Without photos, the category photo is used." />
        <div className="p-5"><PhotoManager photos={p.images} onChange={(images) => set({ images })} folder={edit ? `products/${edit.slug}` : "products/new"} /></div>
      </Card>

      <Card>
        <CardHeader title="Options, prices and stock" subtitle="Prices in KES. Wholesale can't be higher than retail." />
        <div className="space-y-4 p-5">
          <div className="max-w-xs">
            <Field label="Options by">
              <select value={p.option_type} onChange={(e) => { set({ option_type: e.target.value }); if (e.target.value === "none") setRows((r) => r.slice(0, Math.max(1, existing))); }} className={inputClass}>
                {OPTION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className={cx("grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-6", r.active ? "border-line" : "border-dashed border-line bg-surface/70")}>
              <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-6">
                <span className="font-semibold">Option {i + 1}</span>
                {r.id ? <Badge tone="neutral">{r.sku}</Badge> : <Badge tone="brand">New</Badge>}
                {!r.active && <Badge tone="amber">Hidden</Badge>}
                {r.id && (
                  <button type="button" onClick={() => setRow(i, { active: !r.active })} className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
                    {r.active ? <><EyeOff className="size-4" /> Hide</> : <><Eye className="size-4" /> Show</>}
                  </button>
                )}
                {!r.id && rows.length > 1 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-rose-fg">
                    <Trash2 className="size-4" /> Remove
                  </button>
                )}
              </div>
              {p.option_type !== "none" && (
                <div className="col-span-2 sm:col-span-6"><Field label="Option name"><input value={r.option} onChange={(e) => setRow(i, { option: e.target.value })} required className={inputClass} placeholder="e.g. 18&quot; or Natural Black" /></Field></div>
              )}
              <Field label="Retail (KES)"><input type="number" min={1} step="any" required value={r.retail} onChange={(e) => setRow(i, { retail: e.target.value })} className={inputClass} /></Field>
              <Field label="Wholesale (KES)"><input type="number" min={1} step="any" required value={r.wholesale} onChange={(e) => setRow(i, { wholesale: e.target.value })} className={inputClass} /></Field>
              {r.id ? (
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">In stock</span>
                  <p className="flex h-11 items-center gap-2 text-[15px]"><strong>{r.onHand ?? 0}</strong>
                    <Link href={`/admin/inventory?q=${encodeURIComponent(r.sku)}`} className="text-sm font-semibold text-brand-700">Adjust</Link></p>
                </div>
              ) : (
                <Field label="Opening stock"><input type="number" min={0} step={1} value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} className={inputClass} /></Field>
              )}
              <Field label="Reorder at"><input type="number" min={0} step={1} value={r.reorder_level} onChange={(e) => setRow(i, { reorder_level: e.target.value })} className={inputClass} /></Field>
              <div className="col-span-2"><Field label={r.id ? "SKU" : "SKU (optional)"}>
                <input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} required={!!r.id} placeholder={r.id ? undefined : "Made for you if empty"} className={inputClass} /></Field></div>
            </div>
          ))}
          {p.option_type !== "none" && rows.length < 20 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="size-4" /> Add option</Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Product page details (optional)" subtitle="Shown in the benefit cards and the How to Use / Ingredients tabs. Leave empty to hide." />
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          {benefits.map((b, i) => (
            <Field key={i} label={`Benefit ${i + 1}`}>
              <input value={b} onChange={(e) => { const next = [...benefits]; next[i] = e.target.value; set({ benefits: next }); }} className={inputClass} />
            </Field>
          ))}
          <div className="sm:col-span-3"><Field label="How to use"><textarea value={p.how_to_use} onChange={(e) => set({ how_to_use: e.target.value })} rows={2} className={cx(inputClass, "h-auto py-3")} /></Field></div>
          <div className="sm:col-span-3"><Field label="Key ingredients"><textarea value={p.ingredients} onChange={(e) => set({ ingredients: e.target.value })} rows={2} className={cx(inputClass, "h-auto py-3")} /></Field></div>
        </div>
      </Card>

      {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
      {saved && <p className="rounded-xl bg-mint-bg px-4 py-3 text-mint-fg" role="status">Saved. The shop shows the changes now.</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : edit ? "Save Changes" : "Add Product"}</Button>
        {edit && <Link href={`/product/${edit.slug}`} target="_blank" className="inline-flex h-11 items-center px-3 font-semibold text-brand-700">View in shop</Link>}
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/products")}>Back to products</Button>
      </div>
    </form>
  );
}
