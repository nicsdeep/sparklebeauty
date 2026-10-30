import { Suspense } from "react";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ShopHeader } from "@/components/shop/header";
import { Logo } from "@/components/logo";
import { StoreProvider } from "@/components/store-provider";
import { CartProvider } from "@/lib/cart";
import { getProfile } from "@/lib/auth";
import { getStoreSettings, telHref, whatsappHref } from "@/lib/store";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [profile, store] = await Promise.all([getProfile(), getStoreSettings()]);
  return (
    <StoreProvider settings={store}>
      <CartProvider>
        <Suspense>
          <ShopHeader userName={profile?.full_name ?? null} isStaff={!!profile && profile.role !== "customer"} />
        </Suspense>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:pb-12">{children}</main>
        <footer className="border-t border-line bg-surface pb-20 md:pb-0">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 text-ink-muted">Beauty for a brighter you. Original products, trusted brands, delivered across Kenya.</p>
              {(store.facebook_url || store.instagram_url) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {store.facebook_url && <a href={store.facebook_url} target="_blank" rel="noopener" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold hover:border-brand-500 hover:text-brand-700">Facebook</a>}
                  {store.instagram_url && <a href={store.instagram_url} target="_blank" rel="noopener" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold hover:border-brand-500 hover:text-brand-700">Instagram</a>}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold">Shop</h3>
              <ul className="mt-3 space-y-2 text-ink-muted">
                <li><Link href="/shop?category=hair" className="hover:text-brand-700">Hair &amp; Wigs</Link></li>
                <li><Link href="/shop?category=cosmetics" className="hover:text-brand-700">Cosmetics</Link></li>
                <li><Link href="/shop?category=skincare" className="hover:text-brand-700">Skincare</Link></li>
                <li><Link href="/shop?offers=1" className="hover:text-brand-700">Offers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Customer care</h3>
              <ul className="mt-3 space-y-2 text-ink-muted">
                <li><Link href="/account#orders" className="hover:text-brand-700">Track your order</Link></li>
                <li><Link href="/contact" className="hover:text-brand-700">Delivery information</Link></li>
                <li><Link href="/account" className="hover:text-brand-700">My account</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Visit or contact us</h3>
              <ul className="mt-3 space-y-2 text-ink-muted">
                <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> <span>{store.address}{store.landmark && <><br />{store.landmark}</>}</span></li>
                <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0" /> {store.hours}</li>
                {store.whatsapp && (
                  <li className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0" /> <a href={whatsappHref(store.whatsapp)} target="_blank" rel="noopener" className="hover:text-brand-700">WhatsApp {store.whatsapp}</a></li>
                )}
                {store.phones.map((p) => (
                  <li key={p.number} className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" /> <span><a href={telHref(p.number)} className="hover:text-brand-700">{p.number}</a> ({p.label})</span></li>
                ))}
                {store.email && (
                  <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0" /> <a href={`mailto:${store.email}`} className="hover:text-brand-700">{store.email}</a></li>
                )}
              </ul>
            </div>
          </div>
          <p className="border-t border-line px-4 py-4 text-center text-sm text-ink-muted">© {new Date().getFullYear()} {store.name} · Demo environment</p>
        </footer>
        {store.whatsapp && (
          <a href={whatsappHref(store.whatsapp, `Hi ${store.name}, I'd like help with…`)} target="_blank" rel="noopener"
            className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-brand-700 md:bottom-6"
            aria-label="Chat with us on WhatsApp">
            <MessageCircle className="size-5" /> <span className="hidden sm:inline">Chat on WhatsApp</span>
          </a>
        )}
      </CartProvider>
    </StoreProvider>
  );
}
