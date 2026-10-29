import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { getCategories, listProducts } from "@/lib/catalog";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([getCategories(), listProducts()]);
  const count = (slug: string) => products.filter((p) => p.category.slug === slug || p.category.parentSlug === slug).length;
  const top = categories.filter((c) => !c.parent_id);

  return (
    <div>
      <PageHeader title="Categories" subtitle="How products are grouped in the shop navigation." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {top.map((c) => {
          const children = categories.filter((x) => x.parent_id === c.id);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div><h2 className="text-lg font-semibold">{c.name}</h2><p className="text-sm text-ink-muted">{c.description}</p></div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{count(c.slug)} products</span>
              </div>
              {children.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {children.map((x) => (
                    <li key={x.id} className="flex justify-between py-2 text-[15px]">
                      <Link href={`/shop?category=${x.slug}`} className="hover:text-brand-700">{x.name}</Link>
                      <span className="text-ink-muted">{count(x.slug)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/shop?category=${c.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand-700">View in shop →</Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
