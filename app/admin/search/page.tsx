import Link from "next/link";
import { LiveSearch } from "@/components/live-search";
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { listProducts } from "@/lib/catalog";
import { listCustomers } from "@/lib/customers";
import { formatDateTime, kes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Search" };

/** Admin-wide search from the top bar: orders, products and customers. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const safe = q.replace(/[%,()]/g, "");
  const supabase = await createClient();
  const [orders, products, customers] = q
    ? await Promise.all([
        supabase.from("orders").select("id, order_number, customer_name, status, total_amount, created_at")
          .or(`order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%`).order("created_at", { ascending: false }).limit(10).then((r) => r.data ?? []),
        listProducts({ q }).then((ps) => ps.slice(0, 10)),
        listCustomers().then((cs) => cs.filter((c) => `${c.full_name} ${c.phone} ${c.email} ${c.business ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 10)),
      ])
    : [[], [], []];
  const total = orders.length + products.length + customers.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”` : "Find orders, products and customers."} />
      <LiveSearch placeholder="Order number, product, customer name or phone" className="max-w-xl" autoFocus={!q} />
      {q && total === 0 && <EmptyState title="Nothing found">Try an order number like SPK-1034, a product name or a phone number.</EmptyState>}
      {orders.length > 0 && (
        <Card>
          <CardHeader title="Orders" />
          <ul className="divide-y divide-line">{orders.map((o) => (
            <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface">
              <span className="font-semibold text-brand-700">{o.order_number}</span><span className="flex-1">{o.customer_name}</span>
              <StatusBadge status={o.status} /><span className="font-semibold">{kes(o.total_amount)}</span>
              <span className="text-sm text-ink-muted">{formatDateTime(o.created_at)}</span></Link></li>
          ))}</ul>
        </Card>
      )}
      {products.length > 0 && (
        <Card>
          <CardHeader title="Products" />
          <ul className="divide-y divide-line">{products.map((p) => (
            <li key={p.id}><Link href={`/admin/products?q=${encodeURIComponent(p.name)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface">
              <span className="flex-1 font-semibold">{p.name}</span><span className="text-sm text-ink-muted">{p.brand} · {p.category.name}</span>
              <span className="font-semibold">{kes(p.variants[0].price)}</span></Link></li>
          ))}</ul>
        </Card>
      )}
      {customers.length > 0 && (
        <Card>
          <CardHeader title="Customers" />
          <ul className="divide-y divide-line">{customers.map((c) => (
            <li key={c.id}><Link href={`/admin/customers/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface">
              <span className="flex-1 font-semibold">{c.full_name}{c.business ? ` · ${c.business}` : ""}</span>
              <span className="text-sm text-ink-muted">{c.phone}</span><span className="font-semibold">{kes(c.spend)}</span></Link></li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
