import Link from "next/link";
import { LiveSearch } from "@/components/live-search";
import { Plus } from "lucide-react";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { getStock, listProducts, productStock } from "@/lib/catalog";
import { kes } from "@/lib/format";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const products = await listProducts({ q: sp.q, category: sp.category, includeHidden: true });
  const stock = await getStock(products.flatMap((p) => p.variants.map((v) => v.id)));

  return (
    <div>
      <PageHeader title="Products" subtitle={`${products.length} products · retail and wholesale prices in KES`}
        action={<div className="flex flex-wrap gap-2"><LiveSearch placeholder="Search products" className="w-64 max-w-full" />
          <ButtonLink href="/admin/products/new" size="sm" className="h-10"><Plus className="size-4" /> Add Product</ButtonLink></div>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">Category</th><th className="px-3 py-3 font-medium">Options</th>
              <th className="px-3 py-3 text-right font-medium">Retail</th><th className="px-3 py-3 text-right font-medium">Wholesale</th>
              <th className="px-3 py-3 text-right font-medium">Available</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
            <tbody>
              {products.map((p) => {
                const s = productStock(p, stock);
                const prices = p.variants.map((v) => v.price);
                const wholesale = p.variants.map((v) => v.wholesale_price ?? v.price);
                const range = (xs: number[]) => (Math.min(...xs) === Math.max(...xs) ? kes(xs[0]) : `${kes(Math.min(...xs))}–${Math.max(...xs).toLocaleString()}`);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><Link href={`/admin/products/${p.id}/edit`} className="font-semibold hover:text-brand-700">{p.name}</Link>
                      {!p.is_active && <Badge tone="amber" className="ml-2">Hidden</Badge>}
                      <span className="block text-sm text-ink-muted">{p.brand}{p.is_featured ? " · Featured" : ""} · <Link href={`/admin/products/${p.id}/edit`} className="font-semibold text-brand-700">Edit</Link></span></td>
                    <td className="px-3 py-3">{p.category.name}</td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{p.variants.length > 1 ? p.variants.map((v) => v.name).join(", ") : "-"}</td>
                    <td className="px-3 py-3 text-right font-semibold">{range(prices)}</td>
                    <td className="px-3 py-3 text-right text-info-fg">{range(wholesale)}</td>
                    <td className="px-3 py-3 text-right">{s.available}</td>
                    <td className="px-5 py-3">{!s.inStock ? <Badge tone="rose">Out of Stock</Badge> : s.low ? <Badge tone="amber">! Low Stock</Badge> : <Badge tone="mint">✓ In Stock</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
