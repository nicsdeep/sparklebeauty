"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Bell, Boxes, Briefcase, ChevronDown, ExternalLink, FolderTree, Gift, Headset, LayoutDashboard, LogOut, Menu, Package,
  Percent, Search, Settings, ShoppingCart, Sparkles, Store, Tags, Users, X,
} from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { Logo } from "@/components/logo";
import { SearchSuggest } from "@/components/search-suggest";
import { cx } from "@/components/ui";
import { signOut } from "@/app/login/actions";

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

export type AdminAlert = { text: string; href: string; tone: "brand" | "amber" | "rose" };

/** Closes a dropdown when the user clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

/**
 * Admin frame: sidebar (collapsible on desktop, a drawer on phones) and the top bar with search,
 * View Store, alerts and the user menu. Badge counts and alerts come from the layout (database).
 */
export function AdminShell({ user, newOrders, lowStock, alerts, supportHref, children }: {
  user: { name: string; role: string };
  newOrders: number;
  lowStock: number;
  alerts: AdminAlert[];
  supportHref: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useDismiss(bell, () => setBell(false));
  const menuRef = useDismiss(menu, () => setMenu(false));

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sparkle-admin-collapsed") === "1"); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { setDrawer(false); setBell(false); setMenu(false); }, [pathname]);

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((c) => {
        try { localStorage.setItem("sparkle-admin-collapsed", c ? "0" : "1"); } catch { /* storage unavailable */ }
        return !c;
      });
    } else setDrawer(true);
  }

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "S";
  const badge = (href: string) => (href === "/admin/orders" && newOrders > 0 ? { n: newOrders, tone: "brand" } : href === "/admin/inventory" && lowStock > 0 ? { n: lowStock, tone: "amber" } : null);

  const nav = (mini: boolean) => (
    <nav className="space-y-1" aria-label="Admin">
      {LINKS.map(({ href, label, Icon, ai }) => {
        const on = active(href);
        const b = badge(href);
        return (
          <Link key={href} href={href} title={mini ? label : undefined} aria-current={on ? "page" : undefined}
            className={cx("relative flex items-center gap-3.5 rounded-xl py-3 text-[15px] font-medium transition-colors", mini ? "justify-center px-0" : "px-4",
              on ? (ai ? "bg-ai-bg text-ai-fg" : "bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(208,35,122,0.6)]") : ai ? "text-ai-fg hover:bg-ai-bg" : "text-ink hover:bg-brand-50")}>
            <Icon className="size-5 shrink-0" strokeWidth={1.8} />
            {!mini && <span className="flex-1">{label}</span>}
            {b && (mini
              ? <span className={cx("absolute right-2 top-2 size-2.5 rounded-full", b.tone === "brand" ? "bg-brand-600" : "bg-amber-fg")} aria-label={`${b.n} need attention`} />
              : <span className={cx("grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs font-bold",
                  b.tone === "brand" ? (on ? "bg-white text-brand-700" : "bg-brand-600 text-white") : "bg-amber-bg text-amber-fg")}>{b.n}</span>)}
          </Link>
        );
      })}
    </nav>
  );

  const support = (mini: boolean) => supportHref && (
    <a href={supportHref} target="_blank" rel="noopener noreferrer" title={mini ? "Contact support" : undefined}
      className={cx("mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 text-[15px] transition hover:bg-brand-100", mini ? "justify-center p-3" : "p-4")}>
      <Headset className="size-7 shrink-0 text-brand-600" strokeWidth={1.6} />
      {!mini && <span><strong className="block font-semibold">Need help?</strong><span className="text-brand-700">Contact support</span></span>}
    </a>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className={cx("no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white transition-[width] lg:flex", collapsed ? "w-20 p-3" : "w-64 p-4")}>
        <div className={cx("mb-6 pt-1", collapsed ? "flex justify-center" : "px-2")}>
          {collapsed ? <Logo href="/admin" size="sm" /> : <Logo href="/admin" size="md" />}
        </div>
        <div className="flex-1 overflow-y-auto">{nav(collapsed)}</div>
        {support(collapsed)}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col overflow-y-auto bg-white p-4">
            <div className="mb-5 flex items-center justify-between px-2"><Logo href="/admin" size="sm" />
              <button onClick={() => setDrawer(false)} aria-label="Close menu" className="p-2"><X className="size-6" /></button></div>
            <div className="flex-1">{nav(false)}</div>
            {support(false)}
          </div>
        </div>
      )}

      <div className={cx("transition-[padding]", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <button onClick={toggleMenu} className="rounded-full p-2 hover:bg-surface" aria-label={collapsed ? "Expand menu" : "Menu"}><Menu className="size-6" /></button>
          <SearchSuggest scope="admin" placeholder="Search orders, products, customers…" className="hidden max-w-md flex-1 sm:block"
            inputClassName="h-11 rounded-xl border border-line bg-surface text-[15px] focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100" />
          <Link href="/admin/search" className="rounded-full p-2 hover:bg-surface sm:hidden" aria-label="Search"><Search className="size-5" /></Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link href="/" className="hidden items-center gap-2 rounded-xl border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:flex">
              <ExternalLink className="size-4" /> View Store
            </Link>

            <div className="relative" ref={bellRef}>
              <button onClick={() => setBell((b) => !b)} aria-expanded={bell} aria-label={`Alerts${alerts.length ? `, ${alerts.length}` : ""}`}
                className="relative rounded-full p-2.5 hover:bg-surface">
                <Bell className="size-[22px]" strokeWidth={1.8} />
                {alerts.length > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{alerts.length}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
                  <p className="border-b border-line px-4 py-3 font-semibold">Needs attention</p>
                  {alerts.length ? (
                    <ul>{alerts.map((a) => (
                      <li key={a.href + a.text}><Link href={a.href} className="flex items-center gap-3 px-4 py-3 text-[15px] hover:bg-surface">
                        <span className={cx("size-2.5 shrink-0 rounded-full", a.tone === "brand" ? "bg-brand-600" : a.tone === "amber" ? "bg-amber-fg" : "bg-rose-fg")} />{a.text}</Link></li>
                    ))}</ul>
                  ) : <p className="px-4 py-4 text-[15px] text-ink-muted">All caught up.</p>}
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="flex items-center gap-2.5 rounded-full p-1 pr-2 hover:bg-surface" aria-label="Account menu">
                <span className="grid size-10 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials}</span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight">{user.name}</span>
                  <span className="block text-xs capitalize text-ink-muted">{user.role}</span>
                </span>
                <ChevronDown className="hidden size-4 text-ink-muted sm:block" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-lg">
                  <Link href="/" className="flex items-center gap-2.5 px-4 py-2.5 text-[15px] hover:bg-surface"><ExternalLink className="size-4" /> View Store</Link>
                  <Link href="/admin/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-[15px] hover:bg-surface"><Settings className="size-4" /> Settings</Link>
                  <form action={signOut}><SubmitButton unstyled className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[15px] text-rose-fg hover:bg-surface"><LogOut className="size-4" /> Sign out</SubmitButton></form>
                </div>
              )}
            </div>
          </div>
        </header>
        <LiveRefresh staff />
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
