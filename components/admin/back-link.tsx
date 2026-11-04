"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

// Back navigation for admin pages (Nicholas, 2026-11-04): Back follows the way the user actually
// came (browser history, so search, filters, page and scroll come back as they were). Someone who
// opened the page directly (a link, a refresh with no history here) goes to the page's parent.

const KEY = "sparkle-admin-trail";
const read = (): string[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (trail: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-30))); } catch { /* storage unavailable */ } };

/** Records the admin pages visited in this tab (in the admin shell). */
export function NavTrail() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const url = `${pathname}${params.size ? `?${params}` : ""}`;
    const trail = read();
    if (trail[trail.length - 1] === url) return;
    // Going back to the previous page (Back button or browser back): step back along the trail.
    if (trail[trail.length - 2] === url) trail.pop();
    // Same page with other filters (search, page number): replace rather than add a step.
    else if (trail.length && trail[trail.length - 1].split("?")[0] === pathname) trail[trail.length - 1] = url;
    else trail.push(url);
    write(trail);
  }, [pathname, params]);
  return null;
}

/** Names for the pages Back can lead to. */
function nameOf(url: string) {
  const path = url.split("?")[0];
  const parts = path.split("/").filter(Boolean);
  const rules: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
    [/^\/admin\/pos$/, "POS"],
    [/^\/admin\/pos\/sales$/, "Recent Sales"],
    [/^\/admin\/pos\/sales\/([^/]+)$/, (m) => `Sale ${decodeURIComponent(m[1])}`],
    [/^\/admin\/pos\/suspended$/, "Suspended Sales"],
    [/^\/admin\/pos\/suspended\/([^/]+)$/, (m) => decodeURIComponent(m[1])],
    [/^\/admin\/orders$/, "Orders"],
    [/^\/admin\/orders\/[^/]+$/, "Order"],
    [/^\/admin\/invoices$/, "Invoices"],
    [/^\/admin\/customers$/, "Customers"],
    [/^\/admin\/customers\/[^/]+$/, "Customer"],
    [/^\/admin$/, "Dashboard"],
  ];
  for (const [re, name] of rules) {
    const m = path.match(re);
    if (m) return typeof name === "string" ? name : name(m);
  }
  return parts.length > 1 ? parts[parts.length - 1].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Back";
}

/** "← Back to Recent Sales": the previous page in this tab if there is one, else `fallback`. */
export function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [prev, setPrev] = useState<string | null>(null);
  useEffect(() => {
    const trail = read();
    const last = trail[trail.length - 1]?.split("?")[0] === pathname ? trail.length - 2 : trail.length - 1;
    setPrev(last >= 0 ? trail[last] : null);
  }, [pathname]);

  return (
    <Link href={prev ?? fallback} onClick={(e) => { if (prev) { e.preventDefault(); router.back(); } }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" /> Back to {prev ? nameOf(prev) : label}
    </Link>
  );
}
