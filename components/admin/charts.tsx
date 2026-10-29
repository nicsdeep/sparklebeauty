import { kes } from "@/lib/format";
import { cx } from "@/components/ui";

/** Simple vertical bar chart (no chart library). Values in KES. */
export function BarChart({ data, height = 180 }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Sales by day">
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className={cx("w-full rounded-t-md transition-colors", d.highlight ? "bg-brand-600" : "bg-brand-200 group-hover:bg-brand-500")}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white group-hover:block">
              {kes(d.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center text-[11px] text-ink-muted">{i % Math.ceil(data.length / 7) === 0 || d.highlight ? d.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

/** Two-part split bar, e.g. Online vs POS. */
export function SplitBar({ a, b }: { a: { label: string; value: number }; b: { label: string; value: number } }) {
  const total = a.value + b.value || 1;
  const pa = Math.round((a.value / total) * 100);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface">
        <div className="bg-brand-600" style={{ width: `${pa}%` }} />
        <div className="bg-logo-blue/70" style={{ width: `${100 - pa}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><span className="mr-1.5 inline-block size-2.5 rounded-full bg-brand-600" />{a.label}<p className="font-semibold">{kes(a.value)} · {pa}%</p></div>
        <div><span className="mr-1.5 inline-block size-2.5 rounded-full bg-logo-blue/70" />{b.label}<p className="font-semibold">{kes(b.value)} · {100 - pa}%</p></div>
      </div>
    </div>
  );
}

/** Horizontal bars for rankings (categories, payment methods…). */
export function HBars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm"><span className="font-medium">{r.label}</span><span className="font-semibold">{r.note ?? kes(r.value)}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "amber" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-bold tracking-tight", tone === "amber" && "text-amber-fg")}>{value}</p>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}
