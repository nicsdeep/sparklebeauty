"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

/** Sort menu for the shop: applies as soon as an option is picked. */
export function SortSelect({ options }: { options: readonly { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-semibold">Sort</span>
      <select value={params.get("sort") ?? ""} className="h-10 rounded-full border border-line bg-white px-3"
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("sort", e.target.value); else next.delete("sort");
          startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
        }}>
        {options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-ink-muted" aria-label="Sorting" />}
    </label>
  );
}
