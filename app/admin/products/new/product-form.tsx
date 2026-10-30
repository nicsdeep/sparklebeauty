"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, cx, inputClass } from "@/components/ui";
import { createProduct, type NewProductInput } from "../../actions";

type Category = { slug: string; name: string; parent: string | null };
type Row = NewProductInput["variants"][number];
const emptyRow = (): Row => ({ option: "", sku: "", retail: "", wholesale: "", stock: "0", reorder_level: "5" });
const OPTION_TYPES = [
  { value: "none", label: "No options (one item)" },
  { value: "length", label: "Length (e.g. 18\")" },
  { value: "colour", label: "Colour" },
  { value: "shade", label: "Shade" },
  { value: "size", label: "Size (e.g. 100ml)" },
];

/** New product with options, retail and wholesale prices and opening stock. admin_create_product() validates. */
export function ProductForm({ categories, brands }: { categories: Category[]; brands: string[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [optionType, setOptionType] = useState("none");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parents = categories.filter((c) => !c.parent);
  const isHair = categories.find((c) => c.slug === category)?.parent === "hair" || category === "hair";
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function submit(form: FormData) {
    setError(null);
    const s = (k: string) => String(form.get(k) ?? "").trim();
    const input: NewProductInput = {
      product: {
        name: s("name"), category_slug: category, brand: s("brand"), description: s("description"), image_url: s("image_url"),
        is_featured: form.get("is_featured") === "on", benefits: [s("benefit1"), s("benefit2"), s("benefit3")].filter(Boolean),
        how_to_use: s("how_to_use"), ingredients: s("ingredients"), option_type: optionType,
        hair_texture: isHair ? s("hair_texture") : "", hair_type: isHair ? s("hair_type") : "",
      },
      variants: optionType === "none" ? rows.slice(0, 1).map((r) => ({ ...r, option: "" })) : rows,
    };
    start(async () => {
      const res = await createProduct(input);
      if (res.ok) router.push(`/admin/products?q=${encodeURIComponent(input.product.name)}`);
      else setError(res.error);
    });
  }

  return (
    <form action={submit} className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader title="Product details" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Product name"><input name="name" required className={inputClass} placeholder="e.g. Body Wave Lace Front Wig" /></Field></div>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputClass}>
              <option value="" disabled>Choose a category</option>
              {parents.map((p) => {
                const kids = categories.filter((c) => c.parent === p.slug);
                return kids.length ? (
                  <optgroup key={p.slug} label={p.name}>{kids.map((k) => <option key={k.slug} value={k.slug}>{k.name}</option>)}</optgroup>
                ) : <option key={p.slug} value={p.slug}>{p.name}</option>;
              })}
            </select>
          </Field>
          <Field label="Brand" hint="Pick one or type a new brand.">
            <input name="brand" list="brand-list" className={inputClass} autoComplete="off" />
            <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={3} className={cx(inputClass, "h-auto py-3")} /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Photo (optional)" hint="A site path like /products/kids/songa-1.jpg or an https:// link. Without one, the category photo is shown.">
              <input name="image_url" className={inputClass} placeholder="/products/…" />
            </Field>
          </div>
          {isHair && (
            <>
              <Field label="Texture (optional)"><input name="hair_texture" className={inputClass} placeholder="e.g. Body Wave" /></Field>
              <Field label="Hair type (optional)"><input name="hair_type" className={inputClass} placeholder="e.g. 100% Human Hair" /></Field>
            </>
          )}
          <label className="flex items-center gap-2.5 text-[15px] font-semibold sm:col-span-2">
            <input type="checkbox" name="is_featured" className="size-5 accent-brand-600" /> Feature on the homepage
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Options, prices and stock" subtitle="Prices in KES. Wholesale can't be higher than retail." />
        <div className="space-y-4 p-5">
          <div className="max-w-xs">
            <Field label="Options by">
              <select value={optionType} onChange={(e) => { setOptionType(e.target.value); if (e.target.value === "none") setRows((r) => r.slice(0, 1)); }} className={inputClass}>
                {OPTION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 rounded-2xl border border-line p-4 sm:grid-cols-6">
              {optionType !== "none" && (
                <div className="col-span-2 sm:col-span-6"><Field label={`Option ${i + 1}`}><input value={r.option} onChange={(e) => setRow(i, { option: e.target.value })} required className={inputClass} /></Field></div>
              )}
              <Field label="Retail (KES)"><input type="number" min={1} step="any" required value={r.retail} onChange={(e) => setRow(i, { retail: e.target.value })} className={inputClass} /></Field>
              <Field label="Wholesale (KES)"><input type="number" min={1} step="any" required value={r.wholesale} onChange={(e) => setRow(i, { wholesale: e.target.value })} className={inputClass} /></Field>
              <Field label="Opening stock"><input type="number" min={0} step={1} value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} className={inputClass} /></Field>
              <Field label="Reorder at"><input type="number" min={0} step={1} value={r.reorder_level} onChange={(e) => setRow(i, { reorder_level: e.target.value })} className={inputClass} /></Field>
              <div className="col-span-2"><Field label="SKU (optional)"><input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} placeholder="Made for you if empty" className={inputClass} /></Field></div>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="col-span-2 flex items-center gap-1.5 justify-self-start text-sm font-semibold text-rose-fg sm:col-span-6">
                  <Trash2 className="size-4" /> Remove option
                </button>
              )}
            </div>
          ))}
          {optionType !== "none" && rows.length < 20 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="size-4" /> Add option</Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Product page details (optional)" subtitle="Shown in the benefit cards and the How to Use / Ingredients tabs. Leave empty to hide." />
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          {[1, 2, 3].map((n) => <Field key={n} label={`Benefit ${n}`}><input name={`benefit${n}`} className={inputClass} /></Field>)}
          <div className="sm:col-span-3"><Field label="How to use"><textarea name="how_to_use" rows={2} className={cx(inputClass, "h-auto py-3")} /></Field></div>
          <div className="sm:col-span-3"><Field label="Key ingredients"><textarea name="ingredients" rows={2} className={cx(inputClass, "h-auto py-3")} /></Field></div>
        </div>
      </Card>

      {error && <p className="text-sm text-rose-fg" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add Product"}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
