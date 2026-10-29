import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { ResetDemo } from "./reset-demo";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [{ data: staff }, { data: tiers }, { data: resets }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").in("role", ["staff", "admin"]).order("role"),
    supabase.from("pricing_tiers").select("name, code, min_order_quantity, is_wholesale"),
    supabase.from("activity_log").select("created_at").eq("action", "demo.reset").order("created_at", { ascending: false }).limit(1),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Store details, staff and demo controls." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Store" />
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 p-5 text-[15px]">
            <dt className="text-ink-muted">Shop</dt><dd>Sparkle Beauty &amp; Cosmetics, Moi Avenue, Nairobi CBD</dd>
            <dt className="text-ink-muted">Currency</dt><dd>Kenyan Shilling (KES)</dd>
            <dt className="text-ink-muted">Delivery</dt><dd>Nairobi KES 300 · elsewhere KES 500 · free over KES 10,000 · pickup free</dd>
            <dt className="text-ink-muted">Loyalty</dt><dd>1 point per KES 100 on completed retail orders · 100 welcome points</dd>
            <dt className="text-ink-muted">Payments</dt><dd>M-Pesa, card, cash (simulated in this demo)</dd>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Price lists" />
          <ul className="divide-y divide-line">
            {(tiers ?? []).map((t) => (
              <li key={t.code} className="flex justify-between px-5 py-3 text-[15px]"><span className="font-semibold">{t.name}</span>
                <span className="text-ink-muted">{t.is_wholesale ? `Minimum ${t.min_order_quantity} items · about 25% below retail` : "Standard shelf price"}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Staff" />
          <ul className="divide-y divide-line">
            {(staff ?? []).map((s) => (
              <li key={s.id} className="flex justify-between px-5 py-3 text-[15px]"><span><strong>{s.full_name}</strong><span className="block text-sm text-ink-muted">{s.email}</span></span>
                <span className="capitalize text-ink-muted">{s.role}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Demo data" subtitle={resets?.[0] ? `Last reset ${formatDateTime(resets[0].created_at)}` : "Seeded starting state"} />
          <div className="p-5">
            {profile.role === "admin"
              ? <ResetDemo />
              : <p className="text-ink-muted">Only an admin can reset the demo.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
