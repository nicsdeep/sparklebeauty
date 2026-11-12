"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, Loader2, Package, Receipt, Search, Tag, UserRound, X } from "lucide-react";
import { cx } from "@/components/ui";
import { sized } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/fetch-all";

/**
 * Search box that suggests matches as you type. Products, categories and customers are loaded
 * once per tab (they're small) and matched instantly in the browser; orders are looked up in the
 * database as you type. Enter opens the full results page; arrow keys pick a suggestion.
 *  - scope "shop": products (by name, brand, category or SKU), brands and categories, results at /shop?q=
 *  - `live` (the Shop page): the product grid also filters as you type, keeping the other filters
 *  - scope "admin": orders, products and customers, results at /admin/search?q= (staff only, by RLS)
 */
type Suggestion = { href: string; title: string; detail: string; image?: string | null; kind: "product" | "brand" | "category" | "order" | "customer" };
type Indexed = Suggestion & { text: string };

const ICON = { product: Package, brand: BadgeCheck, category: Tag, order: Receipt, customer: UserRound };
const GROUP = { product: "Products", brand: "Brands", category: "Categories", order: "Orders", customer: "Customers" };
const cache: Partial<Record<"shop" | "admin", Promise<Indexed[]>>> = {};

function loadIndex(scope: "shop" | "admin"): Promise<Indexed[]> {
  cache[scope] ??= (async () => {
    const supabase = createClient();
    // The shop lists only products on sale; staff also find hidden ones.
    const productPage = (from: number, to: number) => {
      let q = supabase.from("products").select("id, name, slug, image_urls, brand:brands(name), category:categories(name), product_variants(sku)");
      if (scope === "shop") q = q.eq("is_active", true);
      return q.order("name").order("id").range(from, to);
    };
    const products = fetchAll(productPage).then(({ data }) => (data ?? []).map((p): Indexed => {
        const brand = (p.brand as unknown as { name: string } | null)?.name ?? "";
        const category = (p.category as unknown as { name: string } | null)?.name ?? "";
        return { kind: "product", href: scope === "shop" ? `/product/${p.slug}` : `/admin/products/${p.id}/edit`, title: p.name,
          detail: [brand, category].filter(Boolean).join(" · "), image: p.image_urls?.[0] ?? null,
          text: `${p.name} ${brand} ${category} ${(p.product_variants as { sku: string }[] | null ?? []).map((v) => v.sku).join(" ")}` };
      }));
    if (scope === "shop") {
      const categories = supabase.from("categories").select("name, slug").then(({ data }) => (data ?? []).map((c): Indexed => (
        { kind: "category", href: `/shop?category=${c.slug}`, title: c.name, detail: "Category", text: c.name })));
      const brands = supabase.from("brands").select("name").eq("is_active", true).order("name").then(({ data }) => (data ?? []).map((b): Indexed => (
        { kind: "brand", href: `/shop?brand=${encodeURIComponent(b.name)}`, title: b.name, detail: "Brand", text: b.name })));
      return (await Promise.all([categories, brands, products])).flat();
    }
    const customers = Promise.all([
      supabase.from("profiles").select("id, full_name, phone, email").eq("role", "customer"),
      supabase.from("wholesale_accounts").select("profile_id, business_name"),
    ]).then(([{ data: people }, { data: biz }]) => {
      const business = new Map((biz ?? []).map((b) => [b.profile_id, b.business_name]));
      return (people ?? []).map((c): Indexed => {
        const b = business.get(c.id);
        return { kind: "customer", href: `/admin/customers/${c.id}`, title: b ?? c.full_name ?? "Customer",
          detail: [b ? c.full_name : null, c.phone, c.email].filter(Boolean).join(" · "), text: `${c.full_name} ${b ?? ""} ${c.email ?? ""} ${phoneForms(c.phone)}` };
      });
    });
    return (await Promise.all([products, customers])).flat();
  })().catch((e) => { delete cache[scope]; throw e; });
  return cache[scope]!;
}

/** 0712 345 678, 254712345678 and +254712345678 all match each other. */
function phoneForms(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.startsWith("254") ? `${d} 0${d.slice(3)}` : d.startsWith("0") ? `${d} 254${d.slice(1)}` : d;
}
const words = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const matches = (text: string, ws: string[]) => { const t = text.toLowerCase().replace(/\s+/g, " ") + " " + text.replace(/\D/g, ""); return ws.every((w) => t.includes(w)); };

async function searchOrders(q: string): Promise<Suggestion[]> {
  const safe = q.replace(/[%,()*]/g, "").trim();
  if (!safe) return [];
  const { data } = await createClient().from("orders").select("id, order_number, customer_name, total_amount")
    .or(`order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%`).order("created_at", { ascending: false }).limit(5);
  return (data ?? []).map((o) => ({ kind: "order", href: `/admin/orders/${o.id}`, title: o.order_number,
    detail: `${o.customer_name ?? "Walk-in"} · KES ${Number(o.total_amount).toLocaleString("en-KE")}` }));
}

/** Highlights the typed words inside a suggestion. */
function Mark({ text, ws }: { text: string; ws: string[] }) {
  if (!ws.length) return <>{text}</>;
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-transparent font-bold text-brand-700">{part}</mark> : part))}</>;
}

export function SearchSuggest({ scope, placeholder, defaultValue = "", autoFocus, className, inputClassName, onNavigate, live, id }: {
  scope: "shop" | "admin"; placeholder: string; defaultValue?: string; autoFocus?: boolean;
  className?: string; inputClassName?: string; onNavigate?: () => void; live?: boolean; id?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const typing = useRef(false);
  const listId = useId();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [local, setLocal] = useState<Suggestion[]>([]);
  const [orders, setOrders] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ws = words(q);

  useEffect(() => { if (!typing.current) setQ(defaultValue); }, [defaultValue]);

  // Arriving from the header's search icon (/shop#search): put the cursor in the box.
  useEffect(() => {
    if (live && id && window.location.hash === `#${id}`) document.getElementById(id)?.focus();
  }, [live, id]);

  // Live mode: the results on this page follow the box as you type (a short pause after the last key).
  useEffect(() => {
    if (!live || !typing.current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim()); else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      typing.current = false;
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, live]);

  // Instant matches from the cached index.
  useEffect(() => {
    if (!ws.length) { setLocal([]); return; }
    let live = true;
    loadIndex(scope).then((index) => {
      if (!live) return;
      const hits = index.filter((s) => matches(s.text, ws));
      // Names that start with what was typed come first.
      hits.sort((a, b) => Number(!a.title.toLowerCase().startsWith(ws[0])) - Number(!b.title.toLowerCase().startsWith(ws[0])));
      setLocal([...hits.filter((s) => s.kind === "category").slice(0, 3), ...hits.filter((s) => s.kind === "brand").slice(0, 3), ...hits.filter((s) => s.kind === "product").slice(0, scope === "shop" ? 6 : 4),
        ...hits.filter((s) => s.kind === "customer").slice(0, 4)]);
    }).catch(() => setLocal([]));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope]);

  // Orders come from the database, a moment after typing pauses.
  useEffect(() => {
    if (scope !== "admin" || !q.trim()) { setOrders([]); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => searchOrders(q).then((r) => { if (live) setOrders(r); }).catch(() => {}).finally(() => { if (live) setLoading(false); }), 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, scope]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = scope === "admin" ? [...orders, ...local] : local;
  useEffect(() => setActive(-1), [q]);

  function go(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }
  function seeAll() {
    const term = q.trim();
    go(scope === "shop" ? (term ? `/shop?q=${encodeURIComponent(term)}` : "/shop") : `/admin/search${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (active >= 0 && items[active]) go(items[active].href);
    else if (live) { setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); }
    else seeAll();
  }

  let lastKind = "";
  const rows: ReactNode[] = items.map((s, i) => {
    const Icon = ICON[s.kind];
    const header = s.kind !== lastKind ? <li key={`h-${s.kind}`} className="px-4 pb-1 pt-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted" role="presentation">{GROUP[s.kind]}</li> : null;
    lastKind = s.kind;
    return [header,
      <li key={s.href} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
        <Link href={s.href} onClick={(e) => { e.preventDefault(); go(s.href); }} onMouseEnter={() => setActive(i)}
          className={cx("flex items-center gap-3 px-4 py-2", active === i && "bg-brand-50")}>
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sized(s.image, 80)} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
          ) : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface"><Icon className="size-4 text-ink-muted" /></span>}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold"><Mark text={s.title} ws={ws} /></span>
            {s.detail && <span className="block truncate text-sm text-ink-muted"><Mark text={s.detail} ws={ws} /></span>}
          </span>
        </Link>
      </li>];
  });

  const show = open && q.trim().length > 0;
  return (
    <div ref={box} className={cx("relative", className)}>
      <form onSubmit={submit} role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input id={id} type="search" enterKeyHint="search" value={q} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder}
          role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { typing.current = true; setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); loadIndex(scope).catch(() => {}); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            // Escape closes the suggestions; it must not also clear the box (search inputs do that natively).
            else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
          }}
          className={cx("w-full pl-11 pr-10 outline-none", inputClassName)} autoComplete="off" />
        {live && q && !loading && (
          <button type="button" onClick={() => { typing.current = true; setQ(""); setOpen(false); }} aria-label="Clear search"
            className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-surface"><X className="size-4" /></button>
        )}
        {loading && <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" aria-hidden />}
      </form>
      {show && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1.5 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white pb-2 shadow-xl">
          {rows}
          {!items.length && !loading && <li className="px-4 py-3 text-[15px] text-ink-muted">No matches for “{q.trim()}”.</li>}
          <li className="mt-1 border-t border-line">
            <button type="button" onClick={live ? () => setOpen(false) : seeAll} className="w-full px-4 pt-2.5 text-left text-sm font-semibold text-brand-700">
              {live ? <>Show all results for “{q.trim()}”</> : <>See all results for “{q.trim()}” ›</>}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
