import Link from "next/link";
import { ArrowDown, ArrowUp, ChartNoAxesColumnIncreasing, type LucideIcon } from "lucide-react";
import { kes } from "@/lib/format";
import { cx } from "@/components/ui";

/** KES in short form for chart axes: 0, 50K, 1.2M. */
const short = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));

/** A round axis maximum (1, 2 or 5 × 10ⁿ steps) so gridlines land on tidy values. */
function niceMax(max: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, max / 3)));
  const unit = [1, 2, 5, 10].map((m) => m * step).find((u) => u * 3 >= max) ?? step * 10;
  return unit * 3;
}

/**
 * Vertical bar chart (no chart library) with a KES axis and gridlines. The highlighted bar
 * (e.g. today) is solid pink with a callout; the others are a soft pink gradient.
 */
export function BarChart({ data, height = 190 }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number }) {
  const top = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const ticks = [3, 2, 1, 0].map((i) => (top / 3) * i);
  // Up to ~14 date labels on wide screens, half that on phones.
  const step = Math.ceil(data.length / 14);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-ink-muted" style={{ height: height + 24 }} aria-hidden>
        {ticks.map((t) => <span key={t} className="-translate-y-1/2 leading-none">{t ? `KES ${short(t)}` : "0"}</span>)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${100 - (t / top) * 100}%` }} aria-hidden />)}
          <div className="relative flex h-full items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Sales by day">
            {data.map((d) => (
              <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
                {d.highlight && (
                  <span className="absolute right-0 z-10 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] leading-tight shadow-sm"
                    style={{ bottom: `calc(${Math.max(2, (d.value / top) * 100)}% + 8px)` }}>
                    <span className="block text-ink-muted">{d.label}</span>
                    <span className="flex items-center gap-1 font-bold"><span className="size-1.5 rounded-full bg-brand-600" />{kes(d.value)}</span>
                  </span>
                )}
                <div className={cx("w-full rounded-t-md transition-colors", d.highlight ? "bg-brand-600" : "bg-gradient-to-t from-brand-200 to-brand-300/80 group-hover:from-brand-300 group-hover:to-brand-500")}
                  style={{ height: `${Math.max(2, (d.value / top) * 100)}%` }} />
                {!d.highlight && (
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white group-hover:block">
                    {kes(d.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 sm:gap-2.5">
          {data.map((d, i) => (
            <span key={d.label} className={cx("flex-1 whitespace-nowrap text-center text-[11px] text-ink-muted", (i / step) % 2 === 1 && "max-sm:invisible", i % step !== 0 && "invisible")}>{d.label}</span>
          ))}
        </div>
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

type KpiTone = "brand" | "info" | "teal" | "amber";
const KPI_TONE: Record<KpiTone, string> = {
  brand: "bg-brand-50 text-brand-600",
  info: "bg-info-bg text-info-fg",
  teal: "bg-teal-bg text-teal-fg",
  amber: "bg-amber-bg text-amber-fg",
};

/** Dashboard stat card: coloured icon tile, value, and a trend or note line underneath. */
export function KpiCard({ label, value, Icon, tone, note, trend, href }: {
  label: string;
  value: string;
  Icon: LucideIcon;
  tone: KpiTone;
  note?: { text: string; direction?: "up" | "down"; tone?: "mint" | "rose" | "brand" | "muted" };
  /** Change against a comparison period, e.g. +12 for 12% up. */
  trend?: number | null;
  href?: string;
}) {
  const noteColour = { mint: "text-mint-fg", rose: "text-rose-fg", brand: "text-brand-700", muted: "text-ink-muted" }[note?.tone ?? "muted"];
  const body = (
    <div className="flex h-full items-start gap-4 rounded-2xl border border-line bg-white p-5 transition hover:border-brand-200 hover:shadow-sm">
      <span className={cx("grid size-14 shrink-0 place-items-center rounded-2xl", KPI_TONE[tone])}><Icon className="size-7" strokeWidth={1.6} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-ink-muted">{label}</p>
          {trend != null && Number.isFinite(trend) ? (
            <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", trend >= 0 ? "bg-mint-bg text-mint-fg" : "bg-rose-bg text-rose-fg")}
              title="Compared with yesterday">{trend >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trend))}%</span>
          ) : (
            <ChartNoAxesColumnIncreasing className={cx("size-5", KPI_TONE[tone].split(" ")[1])} aria-hidden />
          )}
        </div>
        <p className="mt-1 text-[1.75rem] font-extrabold leading-tight tracking-tight">{value}</p>
        {note && (
          <p className={cx("mt-1 flex items-center gap-1 text-sm font-medium", noteColour)}>
            {note.direction === "up" && <ArrowUp className="size-3.5" />}{note.direction === "down" && <ArrowDown className="size-3.5" />}{note.text}
          </p>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
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
