import Link from "next/link";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { Stat } from "@/components/admin/charts";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Loyalty" };

export default async function LoyaltyPage() {
  const supabase = await createClient();
  const [{ data: members }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, loyalty_points").eq("role", "customer").gt("loyalty_points", 0).order("loyalty_points", { ascending: false }),
    supabase.from("loyalty_transactions").select("id, points, reason, created_at, customer:profiles(id, full_name)").order("created_at", { ascending: false }).limit(15),
  ]);
  const total = (members ?? []).reduce((s, m) => s + m.loyalty_points, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty" subtitle="Sparkle Rewards: 1 point for every KES 100 on completed retail orders (online and in store). 100 welcome points. 1 point = KES 1 off." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Members with points" value={String(members?.length ?? 0)} />
        <Stat label="Points outstanding" value={total.toLocaleString()} note={`Worth KES ${total.toLocaleString()}`} />
        <Stat label="Points earned (latest 15)" value={(recent ?? []).reduce((s, t) => s + t.points, 0).toLocaleString()} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top members" />
          <ol className="divide-y divide-line">
            {(members ?? []).slice(0, 12).map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-[15px]">
                <span className="w-5 font-bold text-ink-muted">{i + 1}</span>
                <Link href={`/admin/customers/${m.id}`} className="flex-1 font-semibold hover:text-brand-700">{m.full_name}<span className="block text-sm font-normal text-ink-muted">{m.phone}</span></Link>
                <span className="font-bold">{m.loyalty_points} pts</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-line">
            {(recent ?? []).map((t) => {
              const c = t.customer as unknown as { id: string; full_name: string } | null;
              return (
                <li key={t.id} className="flex justify-between gap-3 px-5 py-2.5 text-[15px]">
                  <span>{c?.full_name}<span className="block text-sm text-ink-muted">{t.reason} · {formatDateTime(t.created_at)}</span></span>
                  <span className="font-semibold text-mint-fg">+{t.points}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
