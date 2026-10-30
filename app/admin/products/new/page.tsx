import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { loadProductFormOptions } from "../form-data";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const { categories, brands } = await loadProductFormOptions();
  return (
    <div>
      <PageHeader title="Add Product" subtitle="Creates the product with its photos, prices and opening stock in one step." />
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
