import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { STATUS_META, PAYMENT_STATUS_META, type OrderStatus, type Tone } from "@/lib/format";
import type { Stock } from "@/lib/catalog";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BUTTON = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200",
  secondary: "border border-brand-600 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-50",
  ghost: "text-ink hover:bg-surface disabled:opacity-50",
  danger: "border border-rose-fg/30 bg-white text-rose-fg hover:bg-rose-bg disabled:opacity-50",
};
const SIZE = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-6 text-base" };

export type ButtonStyle = { variant?: keyof typeof BUTTON; size?: keyof typeof SIZE };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}) {
  return cx("inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed", BUTTON[variant], SIZE[size]);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button {...props} className={cx(buttonClass({ variant, size }), className)} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link {...props} className={cx(buttonClass({ variant, size }), className)} />;
}

const TONE: Record<Tone, string> = {
  mint: "bg-mint-bg text-mint-fg",
  amber: "bg-amber-bg text-amber-fg",
  rose: "bg-rose-bg text-rose-fg",
  info: "bg-info-bg text-info-fg",
  teal: "bg-teal-bg text-teal-fg",
  ai: "bg-ai-bg text-ai-fg",
  neutral: "bg-surface text-ink-muted",
  brand: "bg-brand-50 text-brand-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as OrderStatus] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StockBadge({ stock, showCount = false }: { stock?: Stock; showCount?: boolean }) {
  if (!stock || !stock.inStock) return <Badge tone="rose">Out of Stock</Badge>;
  if (stock.low) return <Badge tone="amber">! Low Stock{showCount ? ` · ${stock.available} left` : ""}</Badge>;
  return <Badge tone="mint">✓ In Stock{showCount ? ` · ${stock.available} available` : ""}</Badge>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

export function CardHeader({ title, action, subtitle }: { title: string; action?: ReactNode; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** AI suggestion container: purple is reserved for AI. Suggestions never act on their own. */
export function AiCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ai-line bg-ai-bg/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ai-fg">
        <Sparkles className="size-4" aria-hidden /> AI Suggestion · {title}
      </div>
      <div className="mt-2 text-[15px] text-ink">{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-ink-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
