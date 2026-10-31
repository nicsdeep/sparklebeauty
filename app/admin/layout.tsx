import { AdminShell, type AdminAlert } from "@/components/admin/shell";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { mainWhatsapp } from "@/lib/store-types";
import { telHref, whatsappHref } from "@/lib/store-types";

export const metadata = { title: { default: "Admin", template: "%s · Sparkle Admin" } };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [{ count: newOrders }, { data: levels }, store] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("inventory_levels").select("quantity, reserved, reorder_level"),
    getStoreSettings(),
  ]);
  const rows = levels ?? [];
  const out = rows.filter((l) => l.quantity - l.reserved <= 0).length;
  const low = rows.filter((l) => l.quantity - l.reserved > 0 && l.quantity - l.reserved <= l.reorder_level).length;

  // The bell lists what needs someone's attention now; each line links to the list that resolves it.
  const alerts: AdminAlert[] = [
    ...(newOrders ? [{ text: `${plural(newOrders, "new order", "new orders")} to confirm`, href: "/admin/orders?tab=new", tone: "brand" as const }] : []),
    ...(out ? [{ text: `${plural(out, "item is", "items are")} out of stock`, href: "/admin/inventory?filter=low", tone: "rose" as const }] : []),
    ...(low ? [{ text: `${plural(low, "item is", "items are")} running low`, href: "/admin/inventory?filter=low", tone: "amber" as const }] : []),
  ];
  const wa = mainWhatsapp(store);
  const support = wa ? whatsappHref(wa, "Hi, I need help with the Sparkle admin.") : store.phones[0] ? telHref(store.phones[0].number) : null;

  return (
    <AdminShell user={{ name: profile.full_name || "Sparkle staff", role: profile.role }} newOrders={newOrders ?? 0}
      lowStock={out + low} alerts={alerts} supportHref={support}>
      {children}
    </AdminShell>
  );
}
