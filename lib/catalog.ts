import { cache } from "react";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Variant = {
  id: string;
  sku: string;
  name: string | null;
  color: string | null;
  shade: string | null;
  size: string | null;
  hair_length: string | null;
  hair_texture: string | null;
  hair_type: string | null;
  hair_style: string | null;
  price: number;
  compare_at: number | null;
  wholesale_price: number | null;
};

export type Stock = { available: number; inStock: boolean; low: boolean };

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rating: number;
  review_count: number;
  is_featured: boolean;
  /** False when staff hid the product from the shop (only admin lists include these). */
  is_active: boolean;
  created_at: string;
  /** First product photo, or null (the UI falls back to a category image). */
  image: string | null;
  /** All product photos, in order (products.image_urls). */
  images: string[];
  benefits: string[];
  how_to_use: string | null;
  ingredients: string | null;
  category: { slug: string; name: string; parentSlug: string | null };
  brand: string | null;
  variants: Variant[];
};

export type Category = { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number };

const PRODUCT_SELECT = `id, name, slug, description, rating, review_count, is_featured, is_active, created_at, image_urls,
  benefits, how_to_use, ingredients,
  category:categories!inner(id, slug, name, parent:parent_id(slug)),
  brand:brands(name),
  product_variants(id, sku, name, color, shade, size, hair_length, hair_texture, hair_type, hair_style, is_active,
    product_prices(amount, compare_at_amount, tier:pricing_tiers(code)))`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    rating: Number(row.rating),
    review_count: row.review_count,
    is_featured: row.is_featured,
    is_active: row.is_active,
    created_at: row.created_at,
    image: row.image_urls?.[0] ?? null,
    images: row.image_urls ?? [],
    benefits: row.benefits ?? [],
    how_to_use: row.how_to_use,
    ingredients: row.ingredients,
    category: { slug: row.category.slug, name: row.category.name, parentSlug: row.category.parent?.slug ?? null },
    brand: row.brand?.name ?? null,
    variants: (row.product_variants ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((v: any) => v.is_active)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retail = v.product_prices.find((p: any) => p.tier?.code === "retail");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wholesale = v.product_prices.find((p: any) => p.tier?.code === "wholesale");
        return {
          id: v.id, sku: v.sku, name: v.name, color: v.color, shade: v.shade, size: v.size,
          hair_length: v.hair_length, hair_texture: v.hair_texture, hair_type: v.hair_type, hair_style: v.hair_style,
          price: Number(retail?.amount ?? 0),
          compare_at: retail?.compare_at_amount ? Number(retail.compare_at_amount) : null,
          wholesale_price: wholesale ? Number(wholesale.amount) : null,
        };
      })
      .sort((a: Variant, b: Variant) => a.price - b.price || a.sku.localeCompare(b.sku)),
  };
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, description, parent_id, sort_order").order("sort_order");
  return (data ?? []) as Category[];
});

export type ProductFilters = { category?: string; q?: string; offers?: boolean; brand?: string; sort?: string; featured?: boolean; limit?: number; includeHidden?: boolean };

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select(PRODUCT_SELECT);
  if (!filters.includeHidden) query = query.eq("is_active", true);

  if (filters.category) {
    const cats = await getCategories();
    const parent = cats.find((c) => c.slug === filters.category);
    if (!parent) return [];
    const ids = [parent.id, ...cats.filter((c) => c.parent_id === parent.id).map((c) => c.id)];
    query = query.in("category_id", ids);
  }
  if (filters.featured) query = query.eq("is_featured", true);

  const { data } = await query.order("is_featured", { ascending: false }).order("name");
  let products = (data ?? []).map(toProduct).filter((p) => p.variants.length > 0);

  if (filters.q) {
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    products = products.filter((p) => { const text = `${p.name} ${p.brand ?? ""} ${p.category.name}`.toLowerCase(); return words.every((w) => text.includes(w)); });
  }
  if (filters.brand) products = products.filter((p) => p.brand === filters.brand);
  if (filters.offers) products = products.filter((p) => p.variants.some((v) => v.compare_at));
  if (filters.sort === "price-asc") products.sort((a, b) => a.variants[0].price - b.variants[0].price);
  if (filters.sort === "price-desc") products.sort((a, b) => b.variants[0].price - a.variants[0].price);
  if (filters.sort === "newest") products.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters.sort === "rating") products.sort((a, b) => b.rating - a.rating);
  return filters.limit ? products.slice(0, filters.limit) : products;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).eq("is_active", true).maybeSingle();
  return data ? toProduct(data) : null;
}

export type Review = { id: string; reviewer_name: string; rating: number; body: string; created_at: string };

/** Written reviews for a product, newest first. */
export async function getReviews(productId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("product_reviews").select("id, reviewer_name, rating, body, created_at")
    .eq("product_id", productId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as Review[];
}

/**
 * Whether the signed-in customer may review the product: signed in, has a delivered or
 * completed order containing it, and hasn't reviewed it yet (submit_review() enforces the same).
 */
export async function reviewEligibility(productId: string, userId: string | null): Promise<"signin" | "eligible" | "reviewed" | "not-bought"> {
  if (!userId) return "signin";
  const supabase = await createClient();
  const [{ data: mine }, { data: bought }] = await Promise.all([
    supabase.from("product_reviews").select("id").eq("product_id", productId).eq("customer_id", userId).maybeSingle(),
    supabase.from("order_items").select("id, order:orders!inner(customer_id, status), variant:product_variants!inner(product_id)")
      .eq("variant.product_id", productId).eq("order.customer_id", userId).in("order.status", ["delivered", "completed"]).limit(1),
  ]);
  if (mine) return "reviewed";
  return bought?.length ? "eligible" : "not-bought";
}

/** Live availability (on hand minus reserved) for the given variants. */
export async function getStock(variantIds: string[]): Promise<Record<string, Stock>> {
  if (variantIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_variant_stock", { p_variant_ids: variantIds });
  const out: Record<string, Stock> = {};
  for (const row of (data ?? []) as { variant_id: string; quantity_available: number; in_stock: boolean; low_stock: boolean }[]) {
    out[row.variant_id] = { available: row.quantity_available, inStock: row.in_stock, low: row.low_stock };
  }
  return out;
}

/** Stock summary for a product: in stock if any variant is. */
export function productStock(product: Product, stock: Record<string, Stock>): Stock {
  const rows = product.variants.map((v) => stock[v.id]).filter(Boolean);
  const available = rows.reduce((s, r) => s + r.available, 0);
  return { available, inStock: available > 0, low: available > 0 && rows.every((r) => !r.inStock || r.low) };
}


/** Product IDs on the signed-in customer's wishlist (empty when signed out). */
export async function getWishlistIds(): Promise<string[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("product_id, wishlist:wishlists!inner(user_id)").eq("wishlist.user_id", user.id);
  return (data ?? []).map((r) => r.product_id);
}
