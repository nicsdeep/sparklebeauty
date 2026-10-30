"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui";

export type ProductTab = { id: string; label: string; content: ReactNode };

/** Accessible tabs for the product page (Description, How to Use, Ingredients, Reviews). */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    const tab = tabs[(next + tabs.length) % tabs.length];
    setActive(tab.id);
    refs.current[tab.id]?.focus();
  }

  return (
    <div className="h-full rounded-3xl border border-line bg-white">
      <div className="flex overflow-x-auto border-b border-line px-2 sm:px-4" role="tablist" aria-label="Product information">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`}
            aria-selected={active === t.id} aria-controls={`panel-${t.id}`} tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cx("-mb-px shrink-0 border-b-[3px] px-4 py-4 text-[15px] font-semibold transition-colors sm:px-5",
              active === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="p-5 sm:p-7">
          {t.content}
        </div>
      ))}
    </div>
  );
}
