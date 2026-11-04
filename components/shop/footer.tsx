import Link from "next/link";
import { Banknote, ChevronDown, Clock, Headset, MapPin, ShieldCheck, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/logo";
import { mainWhatsapp, whatsappHref, type StoreSettings } from "@/lib/store-types";
import { SocialIcon, WhatsAppLogo, type Social } from "@/components/shop/social-icons";

type Column = { title: string; Icon: typeof ShoppingBag; links: { label: string; href: string }[] };

const COLUMNS: Column[] = [
  { title: "Shop", Icon: ShoppingBag, links: [
    { label: "Hair & Wigs", href: "/shop?category=hair" },
    { label: "Cosmetics", href: "/shop?category=cosmetics" },
    { label: "Skincare", href: "/shop?category=skincare" },
    { label: "Perfumes", href: "/shop?category=perfumes" },
    { label: "Accessories", href: "/shop?category=accessories" },
    { label: "Offers & Deals", href: "/shop?offers=1" },
  ] },
  { title: "Customer Care", Icon: Headset, links: [
    { label: "Track Your Order", href: "/account#orders" },
    { label: "Delivery Information", href: "/delivery" },
    { label: "Returns & Refunds", href: "/returns" },
    { label: "FAQs", href: "/faqs" },
    { label: "Contact Us", href: "/contact" },
  ] },
  { title: "Policies", Icon: ShieldCheck, links: [
    { label: "Shipping Policy", href: "/shipping-policy" },
    { label: "Return & Refund Policy", href: "/returns" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Cookie Policy", href: "/cookies" },
  ] },
];

/** "0797 468 963" → "+254 797 468 963" */
function intlPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const n = d.startsWith("0") ? d.slice(1) : d.startsWith("254") ? d.slice(3) : d;
  return n.length === 9 ? `+254 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : phone;
}

function Heading({ Icon, title }: { Icon: Column["Icon"]; title: string }) {
  return <span className="flex items-center gap-2 font-semibold text-ink"><Icon className="size-[18px] text-brand-600" aria-hidden /> {title}</span>;
}

const linkClass = "text-ink-muted transition-colors hover:text-brand-700";

function Links({ links }: { links: Column["links"] }) {
  return <ul className="space-y-2.5">{links.map((l) => <li key={l.label}><Link href={l.href} className={linkClass}>{l.label}</Link></li>)}</ul>;
}

function Contact({ store }: { store: StoreSettings }) {
  const wa = mainWhatsapp(store);
  return (
    <ul className="space-y-3 text-ink-muted">
      <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /><span>{store.address}{store.landmark && <><br /><span className="text-sm">{store.landmark}</span></>}</span></li>
      <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />{store.hours}</li>
      {wa && (
        <li>
          <a href={whatsappHref(wa)} target="_blank" rel="noopener" className="group inline-flex items-center gap-2.5 font-semibold text-ink">
            <span className="grid size-8 place-items-center rounded-full bg-[#25D366] text-white transition-transform group-hover:scale-105"><WhatsAppLogo className="size-4" /></span>
            <span className="group-hover:text-[#128C7E]">{intlPhone(wa)}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

/** Decorative wave lines and a line drawing of a lipstick, compact and sparkles. */
function Artwork() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1440 400">
      <path d="M0 120 C 240 60 420 180 720 120 S 1200 40 1440 110" fill="none" stroke="#f6c3dd" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M0 170 C 260 110 480 230 760 170 S 1220 90 1440 160" fill="none" stroke="#f6c3dd" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M0 400 L0 330 C 300 280 520 380 820 330 S 1250 270 1440 320 L1440 400 Z" fill="#fbe1ee" fillOpacity=".45" />
    </svg>
  );
}

function CosmeticArt() {
  return (
    <svg aria-hidden viewBox="0 0 220 140" className="pointer-events-none absolute bottom-0 left-0 hidden w-44 text-brand-200 md:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* lipstick */}
      <rect x="30" y="80" width="26" height="56" rx="3" />
      <rect x="34" y="62" width="18" height="18" rx="2" />
      <path d="M36 62 V44 L50 34 V62" />
      {/* compact */}
      <ellipse cx="112" cy="122" rx="38" ry="12" />
      <path d="M74 122 v6 c0 7 17 12 38 12 s38-5 38-12 v-6" />
      <ellipse cx="112" cy="121" rx="24" ry="6" strokeOpacity=".7" />
      {/* brush */}
      <path d="M168 136 L196 60" />
      <path d="M192 58 c4-14 14-20 18-16 s-2 14-12 22 z" />
      {/* sparkles */}
      <path d="M82 50 l3 9 9 3 -9 3 -3 9 -3-9 -9-3 9-3 z" strokeWidth="1.5" />
      <path d="M150 24 l2 6 6 2 -6 2 -2 6 -2-6 -6-2 6-2 z" strokeWidth="1.5" />
    </svg>
  );
}

function PaymentMarks() {
  const badge = "flex h-8 items-center rounded-md border border-line bg-white px-2.5 text-xs font-extrabold tracking-tight";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Payment methods">
      <span className={badge}><span className="text-ink">M</span><span className="text-brand-600">-</span><span className="text-ink">PESA</span></span>
      <span className={`${badge} italic text-[#1a1f71]`}>VISA</span>
      <span className={badge} title="Mastercard">
        <svg viewBox="0 0 38 24" className="h-5 w-8" aria-label="Mastercard"><circle cx="14" cy="12" r="8" fill="#eb001b" /><circle cx="24" cy="12" r="8" fill="#f79e1b" fillOpacity=".9" /></svg>
      </span>
      <span className={`${badge} gap-1 font-semibold text-ink-muted`}><Banknote className="size-4" aria-hidden /> Cash</span>
    </div>
  );
}

export function ShopFooter({ store }: { store: StoreSettings }) {
  const socials = ([
    ["instagram", store.instagram_url], ["facebook", store.facebook_url], ["tiktok", store.tiktok_url], ["youtube", store.youtube_url],
  ] as [Social, string | null][]).filter(([, url]) => url);

  return (
    <footer className="relative overflow-hidden border-t border-brand-100 bg-gradient-to-b from-white via-[#fef7fa] to-brand-50 pb-20 md:pb-0">
      <Artwork />
      <CosmeticArt />
      <div className="relative mx-auto max-w-7xl px-4 pt-10 md:pt-14">
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr_1.4fr] lg:gap-10">
          <div className="md:col-span-3 lg:col-span-1">
            <Logo size="lg" tone="brand" />
            <p className="mt-4 max-w-xs text-ink-muted">Beauty for a brighter you. Original products, trusted brands, delivered across Kenya.</p>
            {socials.length > 0 && (
              <ul className="mt-5 flex gap-4">
                {socials.map(([kind, url]) => (
                  <li key={kind}>
                    <a href={url!} target="_blank" rel="noopener" aria-label={`Sparkle on ${kind[0].toUpperCase()}${kind.slice(1)}`}
                      className="block text-brand-600 transition hover:-translate-y-0.5 hover:text-brand-700">
                      <SocialIcon kind={kind} className="size-6" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tablet and desktop: open columns */}
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title} className="hidden md:block">
              <Heading Icon={c.Icon} title={c.title} />
              <div className="mt-4"><Links links={c.links} /></div>
            </nav>
          ))}
          <div className="hidden md:block">
            <Heading Icon={MapPin} title="Get in Touch" />
            <div className="mt-4"><Contact store={store} /></div>
          </div>

          {/* Mobile: accordions */}
          <div className="divide-y divide-brand-100 border-y border-brand-100 md:hidden">
            {COLUMNS.map((c) => (
              <details key={c.title} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
                  <Heading Icon={c.Icon} title={c.title} />
                  <ChevronDown className="size-5 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="pb-4 pl-[26px]"><Links links={c.links} /></div>
              </details>
            ))}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
                <Heading Icon={MapPin} title="Get in Touch" />
                <ChevronDown className="size-5 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="pb-4"><Contact store={store} /></div>
            </details>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-brand-100 py-5 text-sm text-ink-muted md:mt-12 md:flex-row md:items-center md:justify-between md:pl-44 md:pr-20">
          <p>© {new Date().getFullYear()} Sparkle Beauty &amp; Cosmetics. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3"><span>We accept</span><PaymentMarks /></div>
        </div>
      </div>
    </footer>
  );
}
