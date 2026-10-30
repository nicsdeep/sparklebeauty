import Link from "next/link";
import { LiveSearch } from "@/components/live-search";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { Stat } from "@/components/admin/charts";
import { RestockButton } from "@/components/admin/restock-button";
import { loadStock, stockState } from "@/lib/sales-data";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getStoreSettings } from "@/lib/store";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const sp = await searchParams;
  const store = await getStoreSettings();
  const supabase = await createClient();
  const [stock, { data: movements }] = await Promise.all([
    loadStock(),
    supabase.from("stock_movements").select("id, movement_type, quantity_change, notes, created_at, variant:product_variants(sku, product:products(name))")
      .order("created_at", { ascending: false }).limit(12),
  ]);
  const q = sp.q?.toLowerCase().trim();
  const rows = stock
    .filter((r) => !q || `${r.product_name} ${r.variant_name ?? ""} ${r.sku}`.toLowerCase().includes(q))
    .filter((r) => sp.filter !== "low" || stockState(r) !== "ok")
    .sort((a, b) => ({ out: 0, low: 1, ok: 2 })[stockState(a)] - ({ out: 0, low: 1, ok: 2 })[stockState(b)] || a.product_name.localeCompare(b.product_name));
  const low = stock.filter((r) => stockState(r) === "low").length;
  const out = stock.filter((r) => stockState(r) === "out").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle={`Main Store, ${store.address}. Online orders reserve stock; dispatch and POS sales deduct it.`} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Variants tracked" value={String(stock.length)} />
        <Stat label="Units on hand" value={stock.reduce((s, r) => s + r.quantity, 0).toLocaleString()} />
        <Stat label="Reserved for orders" value={stock.reduce((s, r) => s + r.reserved, 0).toLocaleString()} />
        <Stat label="Low / out of stock" value={`${low} / ${out}`} tone={low + out ? "amber" : undefined} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/inventory" className={cx("rounded-full px-4 py-2 text-sm font-semibold", sp.filter !== "low" ? "bg-brand-600 text-white" : "border border-line bg-white")}>All items</Link>
        <Link href="/admin/inventory?filter=low" className={cx("rounded-full px-4 py-2 text-sm font-semibold", sp.filter === "low" ? "bg-brand-600 text-white" : "border border-line bg-white")}>Low &amp; out of stock</Link>
        <LiveSearch placeholder="Search product or SKU" className="ml-auto w-64 max-w-full" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">SKU</th><th className="px-3 py-3 text-right font-medium">On hand</th>
              <th className="px-3 py-3 text-right font-medium">Reserved</th><th className="px-3 py-3 text-right font-medium">Available</th><th className="px-3 py-3 text-right font-medium">Reorder at</th>
              <th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Adjust</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = stockState(r);
                return (
                  <tr key={r.variant_id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><Link href={`/product/${r.product_slug}`} className="font-semibold hover:text-brand-700">{r.product_name}</Link>{r.variant_name && <span className="block text-sm text-ink-muted">{r.variant_name}</span>}</td>
                    <td className="px-3 py-3 font-mono text-sm">{r.sku}</td>
                    <td className="px-3 py-3 text-right">{r.quantity}</td>
                    <td className="px-3 py-3 text-right">{r.reserved || "-"}</td>
                    <td className="px-3 py-3 text-right font-bold">{r.available}</td>
                    <td className="px-3 py-3 text-right text-ink-muted">{r.reorder_level}</td>
                    <td className="px-3 py-3">{st === "out" ? <Badge tone="rose">Out of Stock</Badge> : st === "low" ? <Badge tone="amber">! Low Stock</Badge> : <Badge tone="mint">✓ In Stock</Badge>}</td>
                    <td className="px-5 py-3"><RestockButton variantId={r.variant_id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="border-b border-line px-5 py-4 font-semibold">Recent stock movements</h2>
        <ul className="divide-y divide-line">
          {(movements ?? []).map((m) => {
            const v = m.variant as unknown as { sku: string; product: { name: string } } | null;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[15px]">
                <span><Badge tone={m.movement_type === "sale" ? "info" : m.movement_type === "reservation" ? "amber" : m.movement_type === "purchase" ? "mint" : "neutral"}>{m.movement_type}</Badge>
                  <span className="ml-2">{v?.product.name}</span> <span className="text-sm text-ink-muted">{m.notes}</span></span>
                <span className="text-sm text-ink-muted"><strong className={m.quantity_change < 0 ? "text-rose-fg" : "text-mint-fg"}>{m.quantity_change > 0 ? "+" : ""}{m.quantity_change}</strong> · {formatDateTime(m.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
