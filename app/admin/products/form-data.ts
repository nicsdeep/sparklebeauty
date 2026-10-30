import { createClient } from "@/lib/supabase/server";

/** Categories (with their parent) and brand names for the product form's pickers. */
export async function loadProductFormOptions() {
  const supabase = await createClient();
  const [{ data: cats }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("slug, name, sort_order, parent:parent_id(slug)").eq("is_active", true).order("sort_order"),
    supabase.from("brands").select("name").eq("is_active", true).order("name"),
  ]);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories: (cats ?? []).map((c: any) => ({ slug: c.slug as string, name: c.name as string, parent: (c.parent?.slug ?? null) as string | null })),
    brands: (brands ?? []).map((b) => b.name),
  };
}
