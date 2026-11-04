import { getStock, listProducts, productStock, type Product, type Stock } from "@/lib/catalog";

// The admin product list and its CSV export read the same filtered, sorted rows.

export type ProductListParams = { q?: string; category?: string; brand?: string; stock?: string; show?: string; sort?: string };

export async function loadProductList(sp: ProductListParams) {
  const all = await listProducts({ includeHidden: true });
  const stock = await getStock(all.flatMap((p) => p.variants.map((v) => v.id)));
  const withStock = all.map((p) => ({ p, s: productStock(p, stock), state: stockState(productStock(p, stock)) }));

  // Totals for the summary cards, across every product (not the current filter).
  const since = Date.now() - 30 * 86400000;
  const totals = {
    products: all.length,
    addedLast30: all.filter((p) => new Date(p.created_at).getTime() >= since).length,
    low: withStock.filter((r) => r.state === "low").length,
    out: withStock.filter((r) => r.state === "out").length,
    featured: all.filter((p) => p.is_featured).length,
    hidden: all.filter((p) => !p.is_active).length,
  };

  const words = (sp.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  let rows = withStock.filter(({ p, state }) =>
    (!sp.category || p.category.slug === sp.category || p.category.parentSlug === sp.category)
    && (!sp.brand || p.brand === sp.brand)
    && (!sp.stock || state === sp.stock)
    && (!sp.show || (sp.show === "featured" ? p.is_featured : sp.show === "hidden" ? !p.is_active : p.is_active))
    && words.every((w) => `${p.name} ${p.brand ?? ""} ${p.category.name} ${p.variants.map((v) => `${v.sku} ${v.name ?? ""}`).join(" ")}`.toLowerCase().includes(w)));

  const min = (p: Product) => Math.min(...p.variants.map((v) => v.price));
  if (sp.sort === "name") rows = rows.sort((a, b) => a.p.name.localeCompare(b.p.name));
  if (sp.sort === "price-asc") rows = rows.sort((a, b) => min(a.p) - min(b.p));
  if (sp.sort === "price-desc") rows = rows.sort((a, b) => min(b.p) - min(a.p));
  if (sp.sort === "stock") rows = rows.sort((a, b) => a.s.available - b.s.available);
  if (sp.sort === "newest") rows = rows.sort((a, b) => b.p.created_at.localeCompare(a.p.created_at));
  const brands = [...new Set(all.map((p) => p.brand).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b));
  return { rows, totals, stock, brands };
}

export function stockState(s: Stock) {
  return !s.inStock ? "out" : s.low ? "low" : "in";
}

/** "KES 18,500" or "KES 18,500 – 26,850". */
export function priceRange(xs: number[]) {
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const f = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
  return lo === hi ? `KES ${f(lo)}` : `KES ${f(lo)} – ${f(hi)}`;
}

/** What tells the options apart, e.g. "14", 18", 22"" or "1B Natural Black, 27 Honey Blonde". */
export function optionsSummary(p: Product) {
  if (p.variants.length < 2) return "";
  return [...new Set(p.variants.map((v) => v.hair_length ?? v.size ?? v.shade ?? v.color ?? v.name).filter(Boolean))].join(", ");
}
