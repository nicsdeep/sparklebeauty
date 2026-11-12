import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";

/** One sellable code and the product it belongs to, for matching photo file names. */
export type PhotoTarget = {
  productId: string; productName: string; category: string; photos: number;
  sku: string; barcode: string | null; variant: string | null;
};

/** Every variant with its product (all of them, in pages: there are more than 1,000). */
export async function loadPhotoTargets(): Promise<PhotoTarget[]> {
  const supabase = await createClient();
  const { data } = await fetchAll((from, to) => supabase.from("product_variants")
    .select("sku, barcode, name, product:products!inner(id, name, image_urls, is_active, category:categories(slug))")
    .eq("product.is_active", true).order("id").range(from, to));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((v) => ({
    productId: v.product.id, productName: v.product.name, category: v.product.category?.slug ?? "", photos: (v.product.image_urls ?? []).length,
    sku: v.sku, barcode: v.barcode, variant: v.name,
  }));
}
