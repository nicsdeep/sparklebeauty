import Link from "next/link";
import { AlertTriangle, Box, Check, PackageX, Pencil, Plus, Star, ImagePlus } from "lucide-react";
import { Pagination } from "@/components/admin/list-controls";
import { ProductImage } from "@/components/shop/product-image";
import { Badge, ButtonLink, Card, cx } from "@/components/ui";
import { getCategories } from "@/lib/catalog";
import { pageParams } from "@/lib/pagination";
import { loadProductList, optionsSummary, priceRange, type ProductListParams } from "./list-data";
import { ProductsToolbar, RowMenu } from "./toolbar";

export const metadata = { title: "Products" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/**
 * The product catalogue for staff (Nicholas's design, 2026-11-04): summary cards that filter the
 * list, search, Filter / Sort / Export, and a paged table. Everything is in the URL.
 */
export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters: ProductListParams = { q: one(sp.q), category: one(sp.category), brand: one(sp.brand), stock: one(sp.stock), show: one(sp.show), sort: one(sp.sort) };
  const { page, size, from } = pageParams(sp);
  const [{ rows, totals, brands }, cats] = await Promise.all([loadProductList(filters), getCategories()]);
  const shown = rows.slice(from, from + size);
  const parents = cats.filter((c) => !c.parent_id);
  const categoryOptions = parents.flatMap((c) => [
    { value: c.slug, label: c.name },
    ...cats.filter((k) => k.parent_id === c.id).map((k) => ({ value: k.slug, label: k.name, hint: c.name })),
  ]);
  const cardHref = (patch: Record<string, string>) => `/admin/products?${new URLSearchParams(patch)}`;

  const cards = [
    { label: "Total Products", value: totals.products, note: `${totals.addedLast30} added in the last 30 days${totals.hidden ? ` · ${totals.hidden} hidden` : ""}`, Icon: Box, tone: "bg-info-bg text-info-fg", href: "/admin/products" },
    { label: "Low Stock", value: totals.low, note: "Running low: reorder soon", Icon: AlertTriangle, tone: "bg-amber-bg text-amber-fg", href: cardHref({ stock: "low" }) },
    { label: "Out of Stock", value: totals.out, note: "Not sellable until restocked", Icon: PackageX, tone: "bg-rose-bg text-rose-fg", href: cardHref({ stock: "out" }) },
    { label: "Featured Products", value: totals.featured, note: "Shown on the homepage", Icon: Star, tone: "bg-brand-50 text-brand-700", href: cardHref({ show: "featured" }) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Box className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-sm text-ink-muted">{totals.products} products · Retail & wholesale prices in KES (Kenyan Shilling)</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/products/photos" variant="secondary"><ImagePlus className="size-4" /> Add Photos</ButtonLink>
          <ButtonLink href="/admin/products/new"><Plus className="size-4" /> Add Product</ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, value, note, Icon, tone, href }) => (
          <Link key={label} href={href} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-ink/20">
            <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", tone)}><Icon className="size-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">{label}</span>
              <span className="block text-2xl font-bold tabular-nums">{value}</span>
              <span className="block text-xs text-ink-muted">{note}</span>
            </span>
          </Link>
        ))}
      </div>

      <ProductsToolbar categories={categoryOptions} brands={brands} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="whitespace-nowrap bg-surface text-sm text-ink-muted"><tr>
              <th className="px-4 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">Category</th><th className="px-3 py-3 font-medium">Variants / Options</th>
              <th className="px-3 py-3 text-right font-medium">Retail (KES)</th><th className="px-3 py-3 text-right font-medium">Wholesale (KES)</th>
              <th className="px-3 py-3 text-right font-medium">Available</th><th className="px-3 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {shown.map(({ p, s, state }) => {
                const edit = `/admin/products/${p.id}/edit`;
                return (
                  <tr key={p.id} className="border-t border-line align-middle hover:bg-surface/50">
                    <td className="min-w-[17rem] px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="size-11 shrink-0"><ProductImage category={p.category.slug} name={p.name} image={p.image} size="sm" className="rounded-lg" /></span>
                        <span className="min-w-0">
                          <Link href={edit} className="block font-semibold hover:text-brand-700">{p.name}</Link>
                          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                            {p.brand}{p.is_featured && <span className="inline-flex items-center gap-0.5 font-medium text-brand-700"><Star className="size-3 fill-current" /> Featured</span>}
                            {!p.is_active && <Badge tone="amber">Hidden</Badge>}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm">{p.category.name}</td>
                    <td className="max-w-56 px-3 py-2.5 text-sm text-ink-muted"><span className="line-clamp-2">{optionsSummary(p) || "–"}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{priceRange(p.variants.map((v) => v.price))}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-info-fg">{priceRange(p.variants.map((v) => v.wholesale_price ?? v.price))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.available}</td>
                    <td className="px-3 py-2.5">
                      {state === "out" ? <Badge tone="rose">Out of stock</Badge> : state === "low" ? <Badge tone="amber"><AlertTriangle className="size-3.5" /> Low stock</Badge> : <Badge tone="mint"><Check className="size-3.5" /> In stock</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={edit} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:border-ink/30"><Pencil className="size-3.5" /> Edit</Link>
                        <RowMenu name={p.name} slug={p.slug} sku={p.variants[0]?.sku ?? ""} active={p.is_active} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                  {filters.q ? <>No products found for “{filters.q}”.</> : "No products match these filters."}{" "}
                  <Link href="/admin/products" className="font-semibold text-brand-700">Clear search and filters</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3"><Pagination page={page} size={size} total={rows.length} noun="products" /></div>
      </Card>
    </div>
  );
}
