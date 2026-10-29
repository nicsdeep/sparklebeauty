import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getStoreSettings } from "@/lib/store";
import { ResetDemo } from "./reset-demo";
import { StoreSettingsForm } from "./store-form";
import { StaffUsers, type StaffUser } from "./staff-users";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireStaff();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const [store, { data: tiers }, { data: resets }, users] = await Promise.all([
    getStoreSettings(),
    supabase.from("pricing_tiers").select("name, code, min_order_quantity, is_wholesale"),
    supabase.from("activity_log").select("created_at").eq("action", "demo.reset").order("created_at", { ascending: false }).limit(1),
    // Includes sign-in status, so it's admin-only (admin_list_users checks the caller).
    isAdmin ? supabase.rpc("admin_list_users").then((r) => (r.data ?? []) as StaffUser[]) : Promise.resolve([] as StaffUser[]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle={isAdmin ? "Shop details, phone numbers, delivery pricing, work users and demo controls." : "Shop details and price lists. Ask an admin to make changes."} />

      <StoreSettingsForm settings={store} canEdit={isAdmin} />

      {isAdmin && <StaffUsers users={users} currentUserId={profile.id} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Price lists" subtitle="Payments: M-Pesa, card and cash (simulated in this demo)." />
          <ul className="divide-y divide-line">
            {(tiers ?? []).map((t) => (
              <li key={t.code} className="flex justify-between px-5 py-3 text-[15px]"><span className="font-semibold">{t.name}</span>
                <span className="text-ink-muted">{t.is_wholesale ? `Minimum ${t.min_order_quantity} items · about 25% below retail` : "Standard shelf price"}</span></li>
            ))}
            <li className="flex justify-between px-5 py-3 text-[15px]"><span className="font-semibold">Loyalty</span>
              <span className="text-ink-muted">1 point per KES 100 on completed retail orders · 100 welcome points</span></li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Demo data" subtitle={resets?.[0] ? `Last reset ${formatDateTime(resets[0].created_at)}` : "Seeded starting state"} />
          <div className="p-5">
            {isAdmin ? <ResetDemo /> : <p className="text-ink-muted">Only an admin can reset the demo.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
