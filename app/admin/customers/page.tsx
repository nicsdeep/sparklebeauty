import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { listCustomers } from "@/lib/customers";
import { formatDate, kes } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.toLowerCase().trim();
  const customers = (await listCustomers())
    .filter((c) => !q || `${c.full_name} ${c.phone} ${c.email} ${c.business ?? ""}`.toLowerCase().includes(q))
    .filter((c) => !sp.type || (sp.type === "wholesale" ? c.business : !c.business))
    .sort((a, b) => b.spend - a.spend);

  return (
    <div>
      <PageHeader title="Customers" subtitle="Contact details, purchase history and loyalty in one place."
        action={<form action="/admin/customers"><input name="q" defaultValue={sp.q} placeholder="Search name, phone or email" className="h-10 w-72 rounded-full border border-line bg-white px-4" aria-label="Search customers" /></form>} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Phone</th><th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th><th className="px-3 py-3 text-right font-medium">Total spend</th>
              <th className="px-3 py-3 font-medium">Last purchase</th><th className="px-5 py-3 text-right font-medium">Points</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-5 py-3"><Link href={`/admin/customers/${c.id}`} className="font-semibold text-brand-700">{c.business ?? c.full_name}</Link>
                    <span className="block text-sm text-ink-muted">{c.business ? <>{c.full_name} · <Badge tone="info">Wholesale</Badge></> : `Joined ${formatDate(c.created_at)}`}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 font-medium"><a href={`tel:${c.phone?.replace(/\s/g, "")}`}>{c.phone}</a></td>
                  <td className="px-3 py-3"><a href={`mailto:${c.email}`} className="hover:text-brand-700">{c.email}</a></td>
                  <td className="px-3 py-3 text-right">{c.orders}</td>
                  <td className="px-3 py-3 text-right font-semibold">{kes(c.spend)}</td>
                  <td className="px-3 py-3">{c.lastPurchase ? formatDate(c.lastPurchase) : "-"}</td>
                  <td className="px-5 py-3 text-right">{c.loyalty_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
