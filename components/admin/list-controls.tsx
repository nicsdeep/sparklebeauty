"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/ui";
import { Combobox, FilterChips, type ComboOption } from "@/components/combobox";

// Filters and pagination for admin list pages. Everything lives in the URL (?page=, ?size=, filters),
// so the list is read from the database page by page, and Back, refresh and links keep the view.

function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!keepPage) next.delete("page");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

/** A compact dropdown filter bound to one URL parameter. */
export function FilterSelect({ label, param, options }: { label: string; param: string; options: [string, string][] }) {
  const { params, set } = useSetParams();
  return (
    <label className="relative block min-w-0">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <select value={params.get(param) ?? ""} onChange={(e) => set({ [param]: e.target.value || null })}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-white pl-3 pr-9 text-sm focus:border-brand-300 focus:outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute bottom-3 right-3 size-4 text-ink-muted" />
    </label>
  );
}

/** A date or number filter bound to one URL parameter (applied when it changes). */
export function FilterInput({ label, param, type, placeholder }: { label: string; param: string; type: "date" | "number"; placeholder?: string }) {
  const { params, set } = useSetParams();
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      <input type={type} defaultValue={params.get(param) ?? ""} placeholder={placeholder} min={type === "number" ? 0 : undefined}
        onChange={(e) => { if (type === "date") set({ [param]: e.target.value || null }); }}
        onBlur={(e) => { if (type === "number" && e.target.value !== (params.get(param) ?? "")) set({ [param]: e.target.value || null }); }}
        onKeyDown={(e) => { if (type === "number" && e.key === "Enter") set({ [param]: e.currentTarget.value || null }); }}
        className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-brand-300 focus:outline-none" />
    </label>
  );
}

/** "Showing 1–20 of 246 sales" with Previous / page numbers / Next and a page-size choice. */
export function Pagination({ page, size, total, noun }: { page: number; size: number; total: number; noun: string }) {
  const { params, set } = useSetParams();
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p > 1) next.set("page", String(p)); else next.delete("page");
    return `?${next}`;
  };
  // 1 … 4 5 6 … 13
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const from = total ? (page - 1) * size + 1 : 0;
  const link = "grid h-9 min-w-9 place-items-center rounded-lg border px-2.5 text-sm font-semibold";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pages">
      <p className="text-ink-muted">Showing {from}–{Math.min(page * size, total)} of {total} {noun}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? <Link href={href(page - 1)} scroll={false} className={cx(link, "border-line bg-white")}><ChevronLeft className="size-4" /> Previous</Link>
          : <span className={cx(link, "border-line text-ink-muted opacity-50")}><ChevronLeft className="size-4" /> Previous</span>}
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-muted">…</span>}
            <Link href={href(n)} scroll={false} aria-current={n === page ? "page" : undefined}
              className={cx(link, n === page ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30")}>{n}</Link>
          </span>
        ))}
        {page < pages ? <Link href={href(page + 1)} scroll={false} className={cx(link, "border-line bg-white")}>Next <ChevronRight className="size-4" /></Link>
          : <span className={cx(link, "border-line text-ink-muted opacity-50")}>Next <ChevronRight className="size-4" /></span>}
        <label className="ml-2 flex items-center gap-1.5 text-ink-muted">Per page
          <select value={size} onChange={(e) => set({ size: e.target.value === "20" ? null : e.target.value })} className="h-9 rounded-lg border border-line bg-white px-2 text-ink">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </nav>
  );
}

/** A searchable filter (shared Combobox) bound to one URL parameter, for long option lists (doctrine §22). */
export function FilterCombobox({ label, param, options, allLabel }: { label: string; param: string; options: ComboOption[]; allLabel: string }) {
  const { params, set } = useSetParams();
  return <Combobox label={label} value={params.get(param) ?? ""} options={options} allLabel={allLabel} onChange={(v) => set({ [param]: v || null })} />;
}

/** The URL filters in use as removable chips, with Clear all (doctrine §28). `labels` names each value. */
export function UrlFilterChips({ params: names, labels }: { params: string[]; labels: Record<string, Record<string, string>> }) {
  const { params, set } = useSetParams();
  const chips = names.filter((n) => params.get(n)).map((n) => {
    const v = params.get(n)!;
    return { key: n, label: labels[n]?.[v] ?? v, onRemove: () => set({ [n]: null }) };
  });
  return <FilterChips chips={chips} onClearAll={() => set(Object.fromEntries(names.map((n) => [n, null])))} />;
}
