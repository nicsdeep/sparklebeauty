import { ProductForm } from "../product-form";
import { loadProductFormOptions } from "../form-data";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const { categories, brands, optionValues } = await loadProductFormOptions();
  return <ProductForm categories={categories} brands={brands} optionValues={optionValues} />;
}
