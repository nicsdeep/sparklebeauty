// Shop filters: which products match the URL filters, and which filter values to offer.
// Values come from the products themselves (UX doctrine §24) and depend on each other (§25):
// each facet offers only values that exist among products matching the *other* active filters.
import type { Product, Stock, Variant } from "@/lib/catalog";

/** URL parameters of the shop page. */
export type ShopQuery = {
  q?: string; category?: string; brand?: string; offers?: string; sort?: string;
  color?: string; length?: string; size?: string; min?: string; max?: string; stock?: string; page?: string;
};

/** Filter parameters (everything except search, sort and page): these show as chips. */
export const FILTER_KEYS = ["category", "brand", "color", "length", "size", "min", "max", "stock", "offers"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type Facets = {
  brands: { value: string; count: number }[];
  colors: string[];
  lengths: string[];
  sizes: string[];
  priceRange: [number, number];
};

const variantValue = { color: (v: Variant) => v.color ?? v.shade, length: (v: Variant) => v.hair_length, size: (v: Variant) => v.size };
type VariantKey = keyof typeof variantValue;

/** Variants of a product that match the colour/length/size filters (all variants when none is set). */
function matchingVariants(p: Product, f: ShopQuery, skip?: VariantKey) {
  return p.variants.filter((v) => (Object.keys(variantValue) as VariantKey[]).every((k) => k === skip || !f[k] || variantValue[k](v) === f[k]));
}

function matches(p: Product, f: ShopQuery, stock: Record<string, Stock>, skip?: FilterKey) {
  if (skip !== "brand" && f.brand && p.brand !== f.brand) return false;
  if (skip !== "offers" && f.offers === "1" && !p.variants.some((v) => v.compare_at)) return false;
  const vs = matchingVariants(p, f, skip === "color" || skip === "length" || skip === "size" ? skip : undefined);
  if (!vs.length) return false;
  if (skip !== "stock" && f.stock === "in" && !vs.some((v) => stock[v.id]?.inStock)) return false;
  if (skip !== "min" && f.min && !vs.some((v) => v.price >= Number(f.min))) return false;
  if (skip !== "max" && f.max && !vs.some((v) => v.price <= Number(f.max))) return false;
  return true;
}

/** Products matching every filter. (Search and category are applied by listProducts.) */
export function applyFilters(products: Product[], f: ShopQuery, stock: Record<string, Stock>) {
  return products.filter((p) => matches(p, f, stock));
}

const sortNatural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function facets(products: Product[], f: ShopQuery, stock: Record<string, Stock>): Facets {
  const values = (key: VariantKey) =>
    [...new Set(products.filter((p) => matches(p, f, stock, key)).flatMap((p) => matchingVariants(p, f, key).map(variantValue[key])))]
      .filter((x): x is string => !!x).sort(sortNatural);
  const brandCounts = new Map<string, number>();
  for (const p of products) if (p.brand && matches(p, f, stock, "brand")) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const prices = products.flatMap((p) => p.variants.map((v) => v.price));
  return {
    brands: [...brandCounts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
    colors: values("color"),
    lengths: values("length"),
    // Sizes that are really lengths (22") belong to the Length filter.
    sizes: values("size").filter((s) => !/^\d+"$/.test(s)),
    priceRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : [0, 0],
  };
}

/** Chip text for an active filter. */
export function filterLabel(key: FilterKey, value: string, categoryName?: string) {
  if (key === "category") return categoryName ?? value;
  if (key === "min") return `From KES ${Number(value).toLocaleString("en-KE")}`;
  if (key === "max") return `Up to KES ${Number(value).toLocaleString("en-KE")}`;
  if (key === "stock") return "In stock";
  if (key === "offers") return "On offer";
  return value;
}
