"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cx } from "@/components/ui";

/**
 * Filter box for list pages: the list updates as you type (a short pause after the last key),
 * keeping the page's other filters. The page reads the same `?q=` it always did, so links and
 * the back button keep working.
 */
export function LiveSearch({ placeholder, param = "q", className, autoFocus }: { placeholder: string; param?: string; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? "";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const typing = useRef(false);

  // Follow the URL when it changes from outside (back button, a filter link).
  useEffect(() => { if (!typing.current) setValue(current); }, [current]);

  useEffect(() => {
    if (value.trim() === current) { typing.current = false; return; }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(param, value.trim()); else next.delete(param);
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
      typing.current = false;
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cx("relative", className)} role="search">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input value={value} onChange={(e) => { typing.current = true; setValue(e.target.value); }} autoFocus={autoFocus}
        placeholder={placeholder} aria-label={placeholder} autoComplete="off"
        className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-9 outline-none focus:border-brand-500" />
      {pending ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" aria-label="Searching" />
        : value && <button type="button" onClick={() => { typing.current = true; setValue(""); }} aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-surface"><X className="size-4" /></button>}
    </div>
  );
}
