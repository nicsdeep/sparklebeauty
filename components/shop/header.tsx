"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Heart, Home, LayoutDashboard, Menu, Package, Search, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";
import { useCart } from "@/lib/cart";

export const NAV = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Hair", href: "/shop?category=hair" },
  { label: "Wigs", href: "/shop?category=wigs" },
  { label: "Braids", href: "/shop?category=braids" },
  { label: "Extensions", href: "/shop?category=extensions" },
  { label: "Cosmetics", href: "/shop?category=cosmetics" },
  { label: "Skincare", href: "/shop?category=skincare" },
  { label: "Perfumes", href: "/shop?category=perfumes" },
  { label: "Accessories", href: "/shop?category=accessories" },
  { label: "Offers", href: "/shop?offers=1" },
  { label: "Contact", href: "/contact" },
];

export function ShopHeader({ userName, isStaff }: { userName: string | null; isStaff: boolean }) {
  const { count, ready } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");

  const current = pathname + (params.toString() ? `?${params}` : "");
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/shop" ? pathname === "/shop" && !params.get("category") && !params.get("offers") : current === href;

  function search(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    router.push(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
  }

  return (
    <>
      <div className="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white">
        Free delivery on orders over KES 10,000 · Pay with M-Pesa, card or cash on delivery
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:gap-8">
          <button className="-ml-2 rounded-full p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-6" />
          </button>
          <Logo />
          <form onSubmit={search} className="hidden flex-1 md:block" role="search">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search wigs, braids, serums, perfumes…"
                aria-label="Search products"
                className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>
          </form>
          <nav className="ml-auto flex items-center gap-1" aria-label="Account">
            {isStaff && (
              <Link href="/admin" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-surface sm:flex">
                <LayoutDashboard className="size-5" /> Admin
              </Link>
            )}
            <Link href={userName ? "/account" : "/login"} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface">
              <User className="size-5" />
              <span className="hidden sm:inline">{userName ? userName.split(" ")[0] : "Sign in"}</span>
            </Link>
            <Link href="/account#wishlist" className="hidden rounded-full p-2.5 hover:bg-surface sm:block" aria-label="Wishlist">
              <Heart className="size-5" />
            </Link>
            <Link href="/cart" className="relative rounded-full p-2.5 hover:bg-surface" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="size-5" />
              {ready && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 pb-2 lg:flex" aria-label="Departments">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-medium transition-colors",
                isActive(n.href) ? "bg-brand-50 text-brand-700" : "text-ink hover:text-brand-700",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-full p-2" aria-label="Close menu">
                <X className="size-6" />
              </button>
            </div>
            <form onSubmit={search} role="search" className="mb-4">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products"
                className="h-11 w-full rounded-full border border-line bg-surface px-4 outline-none focus:border-brand-500" />
            </form>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                className={cx("rounded-xl px-3 py-3 text-base font-medium", isActive(n.href) ? "bg-brand-50 text-brand-700" : "")}>
                {n.label}
              </Link>
            ))}
            {isStaff && (
              <Link href="/admin" onClick={() => setOpen(false)} className="mt-3 rounded-xl px-3 py-3 text-base font-semibold text-brand-700">
                Admin dashboard
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Quick links">
        {[
          { href: "/", label: "Home", Icon: Home },
          { href: "/shop", label: "Shop", Icon: Search },
          { href: "/cart", label: "Cart", Icon: ShoppingBag },
          { href: "/account#orders", label: "Orders", Icon: Package },
          { href: userName ? "/account" : "/login", label: "Account", Icon: User },
        ].map(({ href, label, Icon }) => (
          <Link key={label} href={href} className={cx("flex flex-col items-center gap-0.5 py-2 text-xs font-medium", pathname === href ? "text-brand-700" : "text-ink-muted")}>
            <Icon className="size-5" />
            {label}
            {label === "Cart" && ready && count > 0 && <span className="sr-only">{count} items</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
