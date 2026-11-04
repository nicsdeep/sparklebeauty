import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ProductForm, type ProductFormValues, type ProductRow } from "../../product-form";
import { loadProductFormOptions } from "../../form-data";

export const metadata = { title: "Edit Product" };

/**
 * Which option type the product's variants use, read back from the saved data. A two-part option
 * (colour + length / size) is named "colour · length" by admin_create_product / admin_update_product.
 */
function optionType(v: { color: string | null; shade: string | null; size: string | null; hair_length: string | null; name: string | null }) {
  if (!v.name) return "none";
  if (v.color && v.hair_length && v.name === `${v.color} · ${v.hair_length}`) return "colour_length";
  if (v.color && v.size && v.name === `${v.color} · ${v.size}`) return "colour_size";
  if (v.hair_length) return "length";
  if (v.shade) return "shade";
  if (v.size) return "size";
  return "colour";
}

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const supabase = await createClient();
  const [{ data: p }, { categories, brands, optionValues }] = await Promise.all([
    supabase.from("products").select(`id, name, slug, description, image_urls, is_featured, is_active, benefits, how_to_use, ingredients, tax_type,
      category:categories(slug), brand:brands(name),
      product_variants(id, sku, barcode, name, color, shade, size, hair_length, hair_texture, hair_type, is_active,
        product_prices(amount, tier:pricing_tiers(code)), inventory_levels(quantity, reorder_level))`).eq("id", id).maybeSingle(),
    loadProductFormOptions(),
  ]);
  if (!p) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants = ((p as any).product_variants ?? []).sort((a: any, b: any) => a.sku.localeCompare(b.sku));
  const first = variants[0];
  const kind = first ? optionType(first) : "none";
  const initial: ProductFormValues = {
    name: p.name, category_slug: (p.category as unknown as { slug: string } | null)?.slug ?? "", brand: (p.brand as unknown as { name: string } | null)?.name ?? "",
    description: p.description ?? "", images: p.image_urls ?? [], is_featured: p.is_featured, is_active: p.is_active,
    benefits: p.benefits ?? [], how_to_use: p.how_to_use ?? "", ingredients: p.ingredients ?? "",
    option_type: kind, hair_texture: first?.hair_texture ?? "", hair_type: first?.hair_type ?? "",
    tax_type: p.tax_type ?? "B",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: ProductRow[] = variants.map((v: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const price = (code: string) => String(v.product_prices.find((x: any) => x.tier?.code === code)?.amount ?? "");
    const level = v.inventory_levels?.[0];
    const two = kind === "colour_length" || kind === "colour_size";
    return { id: v.id, option: two ? v.color : v.name ?? "", option2: two ? (kind === "colour_length" ? v.hair_length : v.size) : "", sku: v.sku, barcode: v.barcode ?? "", retail: price("retail"), wholesale: price("wholesale"), stock: "0",
      reorder_level: String(level?.reorder_level ?? 5), active: v.is_active, onHand: level?.quantity ?? 0 };
  });

  return (
    <ProductForm categories={categories} brands={brands} optionValues={optionValues} initial={initial} initialRows={rows} edit={{ id: p.id, slug: p.slug }}
      notice={<>{!p.is_active && <Badge tone="amber">Hidden from the shop</Badge>}{created && <Badge tone="mint">✓ Product added</Badge>}</>} />
  );
}
