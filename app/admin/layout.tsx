import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export const metadata = { title: { default: "Admin", template: "%s · Sparkle Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [{ count: newOrders }, { data: levels }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("inventory_levels").select("quantity, reserved, reorder_level"),
  ]);
  const lowStock = (levels ?? []).filter((l) => l.quantity - l.reserved <= l.reorder_level).length;

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar newOrders={newOrders ?? 0} lowStock={lowStock} />
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center justify-end gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="mr-auto lg:hidden" />
          <Link href="/" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface">
            <ExternalLink className="size-4" /> View Store
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{profile.full_name}</p>
            <p className="text-xs capitalize text-ink-muted">{profile.role}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-full p-2.5 hover:bg-surface" aria-label="Sign out"><LogOut className="size-5" /></button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
