"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, Briefcase, FolderTree, Gift, LayoutDashboard, Menu, Package, Percent, Settings, ShoppingCart,
  Sparkles, Store, Tags, Users, X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingCart },
  { href: "/admin/pos", label: "POS", Icon: Store },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/categories", label: "Categories", Icon: FolderTree },
  { href: "/admin/inventory", label: "Inventory", Icon: Boxes },
  { href: "/admin/customers", label: "Customers", Icon: Users },
  { href: "/admin/retail", label: "Retail", Icon: Tags },
  { href: "/admin/wholesale", label: "Wholesale", Icon: Briefcase },
  { href: "/admin/promotions", label: "Promotions", Icon: Percent },
  { href: "/admin/loyalty", label: "Loyalty", Icon: Gift },
  { href: "/admin/reports", label: "Reports", Icon: BarChart3 },
  { href: "/admin/insights", label: "AI Insights", Icon: Sparkles, ai: true },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminSidebar({ newOrders, lowStock }: { newOrders: number; lowStock: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="space-y-0.5" aria-label="Admin">
      {LINKS.map(({ href, label, Icon, ai }) => (
        <Link key={href} href={href} onClick={() => setOpen(false)}
          className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
            active(href) ? (ai ? "bg-ai-bg text-ai-fg" : "bg-brand-600 text-white") : ai ? "text-ai-fg hover:bg-ai-bg" : "text-ink hover:bg-surface")}>
          <Icon className="size-5" />
          <span className="flex-1">{label}</span>
          {href === "/admin/orders" && newOrders > 0 && (
            <span className={cx("rounded-full px-2 text-xs font-bold", active(href) ? "bg-white text-brand-700" : "bg-brand-600 text-white")}>{newOrders}</span>
          )}
          {href === "/admin/inventory" && lowStock > 0 && (
            <span className={cx("rounded-full px-2 text-xs font-bold", active(href) ? "bg-white text-amber-fg" : "bg-amber-bg text-amber-fg")}>{lowStock}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <div className="mb-6 px-2 pt-1"><Logo href="/admin" subtitle="Business Admin" /></div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>
      <button className="no-print fixed left-3 top-3 z-30 rounded-full bg-white p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu"><Menu className="size-6" /></button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-4">
            <div className="mb-5 flex items-center justify-between px-2"><Logo href="/admin" subtitle="Business Admin" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2"><X className="size-6" /></button></div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
