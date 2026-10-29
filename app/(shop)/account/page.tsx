import Link from "next/link";
import type { Metadata } from "next";
import { Bell, Gift, Heart, MapPin, Package } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Field, StatusBadge, inputClass } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, kes } from "@/lib/format";
import { markNotificationsRead, updatePreferences } from "../actions";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const profile = await requireUser("/account");
  const supabase = await createClient();
  const [orders, notifications, wishlist, addresses, loyalty] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, channel, total_amount, created_at, order_items(quantity)")
      .eq("customer_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, link, read_at, created_at").eq("user_id", profile.id)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("wishlist_items").select("product:products(id, name, slug, image_urls, category:categories(slug), brand:brands(name)), wishlist:wishlists!inner(user_id)")
      .eq("wishlist.user_id", profile.id),
    supabase.from("customer_addresses").select("*").eq("user_id", profile.id).order("is_default", { ascending: false }),
    supabase.from("loyalty_transactions").select("id, points, reason, created_at").eq("customer_id", profile.id)
      .order("created_at", { ascending: false }).limit(6),
  ]);
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;
  const spent = (orders.data ?? []).filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink-muted">My account</p>
          <h1 className="text-3xl font-bold tracking-tight">Hello, {profile.full_name?.split(" ")[0] ?? "there"}</h1>
        </div>
        <form action={signOut}><Button variant="ghost" className="border border-line">Sign Out</Button></form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-full bg-brand-50 p-3 text-brand-600"><Gift className="size-6" /></span>
          <div><p className="text-sm text-ink-muted">Loyalty points</p><p className="text-2xl font-bold">{profile.loyalty_points.toLocaleString()}</p>
            <p className="text-sm text-ink-muted">1 point per KES 100 spent</p></div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-full bg-brand-50 p-3 text-brand-600"><Package className="size-6" /></span>
          <div><p className="text-sm text-ink-muted">Orders</p><p className="text-2xl font-bold">{orders.data?.length ?? 0}</p><p className="text-sm text-ink-muted">{kes(spent)} spent</p></div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-full bg-brand-50 p-3 text-brand-600"><Bell className="size-6" /></span>
          <div><p className="text-sm text-ink-muted">Notifications</p><p className="text-2xl font-bold">{unread}</p><p className="text-sm text-ink-muted">unread</p></div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <div id="orders" className="scroll-mt-40"><CardHeader title="My orders" subtitle="Online and in-store purchases" /></div>
          {orders.data?.length ? (
            <ul className="divide-y divide-line">
              {orders.data.map((o) => (
                <li key={o.id}>
                  <Link href={`/order/${o.order_number}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
                    <div>
                      <p className="font-semibold">{o.order_number}</p>
                      <p className="text-sm text-ink-muted">{formatDate(o.created_at)} · {o.order_items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)} items · {o.channel === "pos" ? "In store" : "Online"}</p>
                    </div>
                    <div className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="font-semibold">{kes(o.total_amount)}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><EmptyState title="No orders yet"><Link href="/shop" className="font-semibold text-brand-700">Start shopping</Link></EmptyState></div>}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Notifications" action={unread > 0 ? <form action={markNotificationsRead}><button className="text-sm font-semibold text-brand-700">Mark all read</button></form> : undefined} />
            <ul className="divide-y divide-line">
              {(notifications.data ?? []).map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <Link href={n.link ?? "#"} className="block">
                    <p className="flex items-center gap-2 font-semibold">{!n.read_at && <span className="size-2 rounded-full bg-brand-600" aria-label="Unread" />}{n.title}</p>
                    <p className="text-sm text-ink-muted">{n.body}</p>
                    <p className="text-xs text-ink-muted">{formatDateTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
              {!notifications.data?.length && <li className="px-5 py-4 text-ink-muted">No notifications yet.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Loyalty history" subtitle="1 point for every KES 100 spent" />
            <ul className="divide-y divide-line">
              {(loyalty.data ?? []).map((t) => (
                <li key={t.id} className="flex justify-between px-5 py-3 text-[15px]">
                  <span>{t.reason}<span className="block text-xs text-ink-muted">{formatDate(t.created_at)}</span></span>
                  <span className="font-semibold text-mint-fg">+{t.points}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div id="wishlist" className="scroll-mt-40"><CardHeader title="Wishlist" /></div>
          <ul className="grid grid-cols-2 gap-3 p-5">
            {(wishlist.data ?? []).map((w) => {
              const p = w.product as unknown as { id: string; name: string; slug: string; image_urls: string[] | null; category: { slug: string }; brand: { name: string } | null };
              return (
                <li key={p.id}><Link href={`/product/${p.slug}`} className="block text-sm font-semibold hover:text-brand-700">
                  <ProductImage category={p.category.slug} name={p.name} image={p.image_urls?.[0]} size="sm" /><span className="mt-1.5 block">{p.name}</span></Link></li>
              );
            })}
            {!wishlist.data?.length && <li className="col-span-2 flex items-center gap-2 text-ink-muted"><Heart className="size-4" /> Tap the heart on any product to save it.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Saved addresses" />
          <ul className="divide-y divide-line">
            {(addresses.data ?? []).map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3 text-[15px]">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <span><strong>{a.label}</strong>{a.is_default && <span className="ml-2 text-xs font-semibold text-brand-700">Default</span>}<br />{a.address_line1}, {a.city}<br /><span className="text-ink-muted">{a.phone}</span></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Profile & communication" />
          <form action={updatePreferences} className="space-y-4 p-5">
            <Field label="Full name"><input name="full_name" defaultValue={profile.full_name ?? ""} className={inputClass} /></Field>
            <Field label="Phone"><input name="phone" defaultValue={profile.phone ?? ""} className={inputClass} /></Field>
            <fieldset className="space-y-2 text-[15px]">
              <legend className="mb-1 text-sm font-semibold">Order updates by</legend>
              <label className="flex items-center gap-2"><input type="checkbox" name="notify_sms" defaultChecked={profile.notify_sms} className="size-4 accent-brand-600" /> SMS</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="notify_whatsapp" defaultChecked={profile.notify_whatsapp} className="size-4 accent-brand-600" /> WhatsApp</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="notify_email" defaultChecked={profile.notify_email} className="size-4 accent-brand-600" /> Email</label>
              <label className="flex items-center gap-2 pt-2"><input type="checkbox" name="marketing_consent" defaultChecked={profile.marketing_consent} className="size-4 accent-brand-600" /> Send me offers and new arrivals</label>
            </fieldset>
            <Button className="w-full">Save Preferences</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
