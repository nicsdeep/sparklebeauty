import { createClient } from "@/lib/supabase/server";

/**
 * Categories (with their parent), brand names, and the option values already in use (colours,
 * shades, sizes, lengths) for the product form's searchable pickers.
 */
export async function loadProductFormOptions() {
  const supabase = await createClient();
  const [{ data: cats }, { data: brands }, { data: variants }] = await Promise.all([
    supabase.from("categories").select("slug, name, sort_order, parent:parent_id(slug)").eq("is_active", true).order("sort_order"),
    supabase.from("brands").select("name").eq("is_active", true).order("name"),
    supabase.from("product_variants").select("color, shade, size, hair_length"),
  ]);
  const values = (key: "color" | "shade" | "size" | "hair_length") =>
    [...new Set((variants ?? []).map((v) => v[key]).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories: (cats ?? []).map((c: any) => ({ slug: c.slug as string, name: c.name as string, parent: (c.parent?.slug ?? null) as string | null })),
    brands: (brands ?? []).map((b) => b.name),
    optionValues: { colour: values("color"), shade: values("shade"), size: values("size"), length: values("hair_length") } as Record<string, string[]>,
  };
}
