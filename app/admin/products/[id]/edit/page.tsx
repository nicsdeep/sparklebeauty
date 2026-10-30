import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ProductForm, type ProductFormValues, type ProductRow } from "../../product-form";
import { loadProductFormOptions } from "../../form-data";

export const metadata = { title: "Edit Product" };

/** Which option column the product's variants use, read back from the saved data. */
function optionType(v: { color: string | null; shade: string | null; size: string | null; hair_length: string | null; name: string | null }) {
  if (!v.name) return "none";
  if (v.hair_length) return "length";
  if (v.shade) return "shade";
  if (v.size) return "size";
  return "colour";
}

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const supabase = await createClient();
  const [{ data: p }, { categories, brands }] = await Promise.all([
    supabase.from("products").select(`id, name, slug, description, image_urls, is_featured, is_active, benefits, how_to_use, ingredients,
      category:categories(slug), brand:brands(name),
      product_variants(id, sku, name, color, shade, size, hair_length, hair_texture, hair_type, is_active,
        product_prices(amount, tier:pricing_tiers(code)), inventory_levels(quantity, reorder_level))`).eq("id", id).maybeSingle(),
    loadProductFormOptions(),
  ]);
  if (!p) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants = ((p as any).product_variants ?? []).sort((a: any, b: any) => a.sku.localeCompare(b.sku));
  const first = variants[0];
  const initial: ProductFormValues = {
    name: p.name, category_slug: (p.category as unknown as { slug: string } | null)?.slug ?? "", brand: (p.brand as unknown as { name: string } | null)?.name ?? "",
    description: p.description ?? "", images: p.image_urls ?? [], is_featured: p.is_featured, is_active: p.is_active,
    benefits: p.benefits ?? [], how_to_use: p.how_to_use ?? "", ingredients: p.ingredients ?? "",
    option_type: first ? optionType(first) : "none", hair_texture: first?.hair_texture ?? "", hair_type: first?.hair_type ?? "",
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: ProductRow[] = variants.map((v: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const price = (code: string) => String(v.product_prices.find((x: any) => x.tier?.code === code)?.amount ?? "");
    const level = v.inventory_levels?.[0];
    return { id: v.id, option: v.name ?? "", sku: v.sku, retail: price("retail"), wholesale: price("wholesale"), stock: "0",
      reorder_level: String(level?.reorder_level ?? 5), active: v.is_active, onHand: level?.quantity ?? 0 };
  });

  return (
    <div>
      <PageHeader title={`Edit ${p.name}`} subtitle="Changes show in the shop as soon as you save."
        action={<div className="flex gap-2">{!p.is_active && <Badge tone="amber">Hidden from the shop</Badge>}{created && <Badge tone="mint">✓ Product added</Badge>}</div>} />
      <ProductForm categories={categories} brands={brands} initial={initial} initialRows={rows} edit={{ id: p.id, slug: p.slug }} />
    </div>
  );
}
