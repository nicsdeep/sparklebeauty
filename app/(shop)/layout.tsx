import { Suspense } from "react";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ShopHeader } from "@/components/shop/header";
import { Logo } from "@/components/logo";
import { CartProvider } from "@/lib/cart";
import { getProfile } from "@/lib/auth";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  return (
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
              <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> Moi Avenue, Nairobi CBD</li>
              <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" /> 0702 388 724</li>
              <li className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0" /> WhatsApp 0702 388 724</li>
              <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0" /> hello@sparklebeauty.co.ke</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line px-4 py-4 text-center text-sm text-ink-muted">© {new Date().getFullYear()} Sparkle Beauty &amp; Cosmetics · Demo environment</p>
      </footer>
    </CartProvider>
  );
}
