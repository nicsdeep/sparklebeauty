"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

// Storefront Back navigation: Back returns to the shop page the customer came from (browser
// history, so filters and scroll come back). Someone who opened the page directly goes home.

const KEY = "sparkle-shop-trail";
const read = (): string[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (trail: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-30))); } catch { /* storage unavailable */ } };

/** Records the storefront pages visited in this tab (mounted once in the shop layout). */
export function ShopTrail() {
  const pathname = usePathname();
  useEffect(() => {
    const trail = read();
    if (trail[trail.length - 1] === pathname) return;
    if (trail[trail.length - 2] === pathname) trail.pop(); // went back
    else trail.push(pathname);
    write(trail);
  }, [pathname]);
  return null;
}

export function ShopBackLink() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasPrev, setHasPrev] = useState(false);
  useEffect(() => {
    const trail = read();
    const at = trail[trail.length - 1] === pathname ? trail.length - 2 : trail.length - 1;
    setHasPrev(at >= 0);
  }, [pathname]);
  return (
    <Link href="/" onClick={(e) => { if (hasPrev) { e.preventDefault(); router.back(); } }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> {hasPrev ? "Back" : "Back to shop"}
    </Link>
  );
}
