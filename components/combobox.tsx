"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cx } from "@/components/ui";

// The searchable dropdown for every long list in Sparkle (UX doctrine §22, §23, §35): open it and
// type at once; results narrow with every key (matches at the start of a word first); arrow keys
// move, Enter picks, Escape closes; mouse and touch work; a clear button resets it. Options come
// from the caller (database values), never from a list kept here.

export type ComboOption = { value: string; label: string; /** Shown smaller beside the label, e.g. the parent category. */ hint?: string };

/** Options matching the typed text: those starting a word first, then any that contain it. */
export function rankOptions(options: ComboOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const starts: ComboOption[] = [], contains: ComboOption[] = [];
  for (const o of options) {
    const text = `${o.label} ${o.hint ?? ""}`.toLowerCase();
    if (text.startsWith(q) || text.includes(` ${q}`)) starts.push(o);
    else if (text.includes(q)) contains.push(o);
  }
  return [...starts, ...contains];
}

export function Combobox({ label, value, options, onChange, allLabel, placeholder = "Type to search…", required, className, allowCustom, error, hideLabel, variant = "filter" }: {
  label: string; value: string; options: ComboOption[]; onChange: (value: string) => void;
  /** Text when nothing is chosen (e.g. "All colours"); also offered as a reset option when set. */
  allLabel?: string; placeholder?: string; required?: boolean; className?: string;
  /** Offer "Use “…”" for text that isn't in the list (a new brand, a new colour). */
  allowCustom?: boolean;
  /** Validation message shown under the control. */
  error?: string | null;
  /** "form" matches the size and label of form fields (Field); "filter" is the compact filter style. */
  variant?: "filter" | "form";
  /** Keep the label for screen readers only (e.g. inside a table row). */
  hideLabel?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? (value && allowCustom ? { value, label: value } : undefined);
  const shown = useMemo(() => {
    const ranked = rankOptions(options, query).slice(0, 100);
    const typed = query.trim();
    const exists = options.some((o) => o.label.toLowerCase() === typed.toLowerCase());
    return allowCustom && typed && !exists ? [{ value: typed, label: `Use “${typed}”`, hint: "new" }, ...ranked] : ranked;
  }, [options, query, allowCustom]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);
  useEffect(() => { setActive(0); }, [query, open]);
  // Keep the highlighted option in view while moving with the keyboard.
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  // Open towards the side with room, so the list never runs off a phone screen (doctrine §38).
  const [alignRight, setAlignRight] = useState(false);
  function openList() {
    const r = box.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left + Math.max(r.width, 256) > window.innerWidth - 8);
    setQuery(""); setOpen(true); requestAnimationFrame(() => input.current?.focus());
  }
  function pick(v: string) { onChange(v); setOpen(false); requestAnimationFrame(() => button.current?.focus()); }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) pick(shown[active].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); button.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={box} className={cx("relative min-w-0", className)}>
      <span id={`${id}-label`} className={cx(variant === "form" ? "mb-1.5 block text-sm font-semibold" : "mb-1 block text-xs font-medium text-ink-muted", hideLabel && "sr-only")}>{label}{required && <span className="text-rose-fg"> *</span>}</span>
      <div className="relative">
        <button ref={button} type="button" onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={(e) => { if (e.key === "ArrowDown" || (e.key.length === 1 && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); openList(); if (e.key.length === 1) setQuery(e.key); } }}
          aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}-value`}
          className={cx("flex w-full items-center gap-2 rounded-xl border bg-white pl-3 text-left transition", variant === "form" ? "h-11 text-[15px]" : "h-10 text-sm", value ? "pr-16" : "pr-9",
            error ? "border-rose-fg" : open ? "border-ink/40" : "border-line hover:border-ink/30")} aria-invalid={!!error}>
          <span id={`${id}-value`} className={cx("truncate", !selected && "text-ink-muted")}>{selected ? selected.label : allLabel ?? "Choose…"}</span>
        </button>
        {value && !required && (
          <button type="button" onClick={() => pick("")} aria-label={`Clear ${label}`} className="absolute right-8 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"><X className="size-3.5" /></button>
        )}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      </div>

      {open && (
        <div className={cx("absolute z-40 mt-1 w-full min-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-line bg-white shadow-xl", alignRight ? "right-0" : "left-0")}>
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder={placeholder}
              role="combobox" aria-expanded aria-controls={`${id}-list`} aria-activedescendant={shown[active] ? `${id}-opt-${active}` : undefined}
              aria-label={`Search ${label}`} autoComplete="off" className="h-10 w-full rounded-lg bg-surface pl-8 pr-2 text-sm outline-none" />
          </div>
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="max-h-[min(18rem,50vh)] overflow-y-auto p-1">
            {allLabel && value && !query && (
              <li><button type="button" onClick={() => pick("")} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink-muted hover:bg-surface">{allLabel}</button></li>
            )}
            {shown.map((o, i) => (
              <li key={o.value} id={`${id}-opt-${i}`} data-index={i} role="option" aria-selected={o.value === value}>
                <button type="button" onClick={() => pick(o.value)} onMouseEnter={() => setActive(i)}
                  className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm", i === active ? "bg-surface" : "")}>
                  <span className="min-w-0 flex-1 truncate">{o.label}{o.hint && <span className="ml-1.5 text-xs text-ink-muted">{o.hint}</span>}</span>
                  {o.value === value && <Check className="size-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-sm text-ink-muted">No {label.toLowerCase()} matches “{query}”.</li>}
          </ul>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-rose-fg" role="alert">{error}</p>}
    </div>
  );
}

/** Active filters as removable chips, with Clear all (UX doctrine §28). */
export function FilterChips({ chips, onClearAll }: { chips: { key: string; label: string; onRemove: () => void }[]; onClearAll: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-xs font-medium">
          {c.label}
          <button type="button" onClick={c.onRemove} aria-label={`Remove ${c.label}`} className="grid size-5 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"><X className="size-3" /></button>
        </span>
      ))}
      {chips.length > 1 && <button type="button" onClick={onClearAll} className="px-1.5 text-xs font-semibold text-brand-700">Clear all</button>}
    </div>
  );
}
