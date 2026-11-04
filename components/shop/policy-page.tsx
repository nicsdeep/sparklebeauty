import Link from "next/link";
import { ShopBackLink } from "@/components/shop/shop-back-link";

/** Date the policy and information pages were last reviewed. Change it whenever their wording changes. */
export const POLICIES_UPDATED = "3 November 2026";

const PAGES = [
  { href: "/delivery", label: "Delivery Information" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/returns", label: "Return & Refund Policy" },
  { href: "/faqs", label: "FAQs" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
];

/**
 * Shared layout for the policy and help pages linked from the footer: back link, title, last-updated
 * date, a readable column, and links to the other pages.
 */
export function PolicyPage({ href, title, intro, children }: { href: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <ShopBackLink />
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_220px]">
        <article className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-ink-muted">Last updated {POLICIES_UPDATED}</p>
          {intro && <p className="mt-5 text-lg text-ink-muted">{intro}</p>}
          <div className="mt-8 space-y-8 leading-relaxed text-ink [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </article>
        <nav aria-label="Policies and help" className="h-fit rounded-xl border border-line bg-white p-4 lg:sticky lg:top-40">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Help &amp; policies</p>
          <ul className="mt-3 space-y-1 text-sm">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} aria-current={p.href === href ? "page" : undefined}
                  className={p.href === href ? "block rounded-md bg-brand-50 px-2 py-1.5 font-semibold text-brand-700" : "block rounded-md px-2 py-1.5 text-ink-muted hover:bg-surface hover:text-ink"}>
                  {p.label}
                </Link>
              </li>
            ))}
            <li><Link href="/contact" className="block rounded-md px-2 py-1.5 text-ink-muted hover:bg-surface hover:text-ink">Contact Us</Link></li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** A clause Sparkle still has to confirm before the page is final. */
export function ToConfirm({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-bg px-1.5 py-0.5 text-amber-fg">
      {children} <span className="text-xs font-semibold uppercase tracking-wide">(to be confirmed by Sparkle)</span>
    </span>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
