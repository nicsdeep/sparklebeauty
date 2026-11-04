import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { ShopHeader } from "@/components/shop/header";
import { ShopFooter } from "@/components/shop/footer";
import { StoreProvider } from "@/components/store-provider";
import { CartProvider } from "@/lib/cart";
import { getProfile } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store";
import { getAnnouncements, resolveAnnouncement } from "@/lib/announcements";
import { WhatsAppChat } from "@/components/shop/whatsapp-chat";
import { ShopTrail } from "@/components/shop/shop-back-link";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [profile, store, announcements] = await Promise.all([getProfile(), getStoreSettings(), getAnnouncements()]);
  const messages = announcements.filter((a) => a.is_active).map((a) => ({
    id: a.id, icon: a.icon, href: a.href,
    text: resolveAnnouncement(a.text, store.free_delivery_threshold),
    mobileText: resolveAnnouncement(a.mobile_text || a.text, store.free_delivery_threshold),
  }));
  return (
    <StoreProvider settings={store}>
      <CartProvider>
        <Suspense>
          <ShopHeader announcements={messages} userName={profile?.full_name ?? null} isStaff={!!profile && profile.role !== "customer"} />
        </Suspense>
        <LiveRefresh />
        <ShopTrail />
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:pb-12">{children}</main>
        <ShopFooter store={store} />
        <WhatsAppChat contacts={store.whatsapp_contacts} storeName={store.name} />
      </CartProvider>
    </StoreProvider>
  );
}
