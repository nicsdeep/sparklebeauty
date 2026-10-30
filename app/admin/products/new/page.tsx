import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: cats }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("slug, name, sort_order, parent:parent_id(slug)").eq("is_active", true).order("sort_order"),
    supabase.from("brands").select("name").eq("is_active", true).order("name"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categories = (cats ?? []).map((c: any) => ({ slug: c.slug, name: c.name, parent: c.parent?.slug ?? null }));

  return (
    <div>
      <PageHeader title="Add Product" subtitle="Creates the product with its prices and opening stock in one step." />
      <ProductForm categories={categories} brands={(brands ?? []).map((b) => b.name)} />
    </div>
  );
}
