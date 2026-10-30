import { Plus } from "lucide-react";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, kes } from "@/lib/format";

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const supabase = await createClient();
  const [{ data: promos }, { data: used }] = await Promise.all([
    supabase.from("promotions").select("*").order("starts_at", { ascending: false }),
    supabase.from("orders").select("promotion_id, discount_amount").not("promotion_id", "is", null).neq("status", "cancelled"),
  ]);
  const usage = new Map<string, { count: number; discount: number }>();
  for (const o of used ?? []) {
    const u = usage.get(o.promotion_id!) ?? { count: 0, discount: 0 };
    u.count += 1; u.discount += Number(o.discount_amount);
    usage.set(o.promotion_id!, u);
  }
  const now = new Date().toISOString();

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Codes customers can use at checkout."
        action={<ButtonLink href="/admin/promotions/new" size="sm" className="h-10"><Plus className="size-4" /> Create Promotion</ButtonLink>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(promos ?? []).map((p) => {
          const live = p.is_active && p.starts_at <= now && (!p.ends_at || p.ends_at > now);
          const scheduled = p.is_active && p.starts_at > now;
          const u = usage.get(p.id);
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="text-lg font-semibold">{p.name}</h2><p className="text-ink-muted">{p.description}</p></div>
                {live ? <Badge tone="mint">Active</Badge> : scheduled ? <Badge tone="info">Scheduled</Badge> : <Badge tone="neutral">Ended</Badge>}
              </div>
              <p className="mt-4 inline-block rounded-lg border border-dashed border-brand-500 bg-brand-50 px-3 py-1.5 font-mono text-lg font-bold text-brand-700">{p.code}</p>
              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-[15px]">
                <dt className="text-ink-muted">Discount</dt><dd>{p.discount_type === "percentage" ? `${Number(p.discount_value)}%` : kes(p.discount_value)}</dd>
                <dt className="text-ink-muted">Minimum order</dt><dd>{kes(p.minimum_order_amount)}</dd>
                <dt className="text-ink-muted">Runs</dt><dd>{formatDate(p.starts_at)}{p.ends_at ? ` – ${formatDate(p.ends_at)}` : ""}</dd>
                <dt className="text-ink-muted">Used</dt><dd>{u?.count ?? 0} orders · {kes(u?.discount ?? 0)} off</dd>
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
