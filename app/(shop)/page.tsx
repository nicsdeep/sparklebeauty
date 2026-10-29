import Link from "next/link";
import { ArrowRight, BadgeCheck, Gift, MapPin, MessageCircle, Phone, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid } from "@/components/shop/product-card";
import { ButtonLink } from "@/components/ui";
import { getStock, getWishlistIds, listProducts } from "@/lib/catalog";
import { CATEGORY_IMAGES, HERO_IMAGE, sized } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { kes } from "@/lib/format";

const DEPARTMENTS = [
  { slug: "wigs", name: "Wigs" },
  { slug: "braids", name: "Braids" },
  { slug: "extensions", name: "Extensions" },
  { slug: "cosmetics", name: "Cosmetics" },
  { slug: "skincare", name: "Skincare" },
  { slug: "perfumes", name: "Perfumes" },
  { slug: "accessories", name: "Accessories" },
];


export default async function HomePage() {
  const supabase = await createClient();
  const store = await getStoreSettings();
  const benefits = [
    { Icon: Truck, title: "Free Delivery", text: `On orders over ${kes(store.free_delivery_threshold)}` },
    { Icon: ShieldCheck, title: "Secure Payments", text: "M-Pesa, card or cash" },
    store.whatsapp
      ? { Icon: MessageCircle, title: "WhatsApp Support", text: store.whatsapp }
      : { Icon: Phone, title: "Customer Support", text: `Call ${store.phones[0]?.number ?? "us"}` },
    { Icon: BadgeCheck, title: "Authentic Products", text: "Trusted global brands" },
    { Icon: Gift, title: "Loyalty Points", text: "Earn on every order" },
  ];
  const [featured, newest, offers, wishlist, { data: promos }] = await Promise.all([
    listProducts({ featured: true, limit: 6 }),
    listProducts({ sort: "newest", limit: 4 }),
    listProducts({ offers: true, limit: 4 }),
    getWishlistIds(),
    supabase.from("promotions").select("code, name, description, minimum_order_amount").order("minimum_order_amount").limit(2),
  ]);
  const stock = await getStock([...featured, ...newest, ...offers].flatMap((p) => p.variants.map((v) => v.id)));

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero */}
      <section className="-mx-4 -mt-6 overflow-hidden bg-brand-50 sm:mx-0 sm:mt-0 sm:rounded-3xl">
        <div className="grid items-stretch md:grid-cols-2">
          <div className="order-2 flex flex-col justify-center px-6 py-10 sm:px-10 md:order-1 md:py-16 lg:px-14">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-700">Premium Beauty Products</p>
            <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Look good, feel good, <span className="text-brand-600">be&nbsp;you.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
              Original wigs, braids and beauty brands at Nairobi prices. Order online, pay with M-Pesa, and get it delivered.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop" size="lg">Shop Now <ArrowRight className="size-5" /></ButtonLink>
              <ButtonLink href="/shop?category=wigs" variant="secondary" size="lg">Browse Wigs</ButtonLink>
            </div>
            <p className="mt-8 flex items-center gap-2 text-sm text-ink-muted">
              <MapPin className="size-4 text-brand-600" /> Visit us in {store.address} · {store.hours.toLowerCase()}
            </p>
          </div>
          <div className="relative order-1 min-h-[320px] md:order-2 md:min-h-[520px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sized(HERO_IMAGE, 1100, 900)}
              srcSet={`${sized(HERO_IMAGE, 700, 600)} 700w, ${sized(HERO_IMAGE, 1100, 900)} 1100w, ${sized(HERO_IMAGE, 1600, 1300)} 1600w`}
              sizes="(min-width: 768px) 50vw, 100vw"
              alt="Woman with long, voluminous curly hair"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-[50%_25%]"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="cat-title">
        <h2 id="cat-title" className="sr-only">Shop by category</h2>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
          {DEPARTMENTS.map((d) => (
            <Link key={d.slug} href={`/shop?category=${d.slug}`}
              className="group w-36 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand-200 hover:shadow-sm sm:w-auto">
              <div className="aspect-[4/3] overflow-hidden bg-brand-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(CATEGORY_IMAGES[d.slug], 360, 270)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="font-semibold">{d.name}</span>
                <ArrowRight className="size-4 text-brand-600 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl bg-brand-50/70 px-5 py-6 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-brand-100" aria-label="Why shop with Sparkle">
        {benefits.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 lg:justify-center lg:px-3">
            <Icon className="size-7 shrink-0 text-brand-600" strokeWidth={1.6} />
            <div>
              <p className="font-semibold leading-tight">{title}</p>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Featured */}
      <section aria-labelledby="featured-title">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 id="featured-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Featured Products</h2>
            <span className="mt-2 block h-1 w-12 rounded-full bg-brand-600" aria-hidden />
          </div>
          <Link href="/shop" className="flex items-center gap-1 font-semibold text-brand-700">View All <ArrowRight className="size-4" /></Link>
        </div>
        <ProductGrid products={featured} stock={stock} wishlist={wishlist} columns={6} />
      </section>

      {/* Promotions from the database */}
      {promos && promos.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Current offers">
          {promos.map((p, i) => {
            const img = CATEGORY_IMAGES[i === 0 ? "skincare" : "wigs"];
            return (
              <Link key={p.code} href={i === 0 ? "/shop?offers=1" : "/shop?category=wigs"}
                className={`group relative flex min-h-48 overflow-hidden rounded-2xl ${i === 0 ? "bg-brand-50" : "bg-brand-600 text-white"}`}>
                <div className="relative z-10 flex max-w-[60%] flex-col justify-center p-6 sm:p-8">
                  <p className={`text-sm font-bold uppercase tracking-[0.16em] ${i === 0 ? "text-brand-700" : "text-brand-100"}`}>{p.name}</p>
                  <p className="mt-2 text-2xl font-extrabold leading-tight">{p.description}</p>
                  <p className={`mt-3 text-sm ${i === 0 ? "text-ink-muted" : "text-brand-50"}`}>
                    Use code <strong className={`rounded-md border border-dashed px-1.5 py-0.5 font-mono ${i === 0 ? "border-brand-500 text-brand-700" : "border-white"}`}>{p.code}</strong> at checkout
                  </p>
                  <span className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${i === 0 ? "bg-brand-600 text-white" : "bg-white text-brand-700"}`}>
                    Shop the offer <ArrowRight className="size-4" />
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(img, 600, 500)} alt="" loading="lazy" className="absolute inset-y-0 right-0 h-full w-[45%] object-cover transition-transform duration-500 group-hover:scale-105" />
              </Link>
            );
          })}
        </section>
      )}

      {offers.length > 0 && (
        <section aria-labelledby="offers-title">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 id="offers-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Special Offers</h2>
              <span className="mt-2 block h-1 w-12 rounded-full bg-brand-600" aria-hidden />
            </div>
            <Link href="/shop?offers=1" className="flex items-center gap-1 font-semibold text-brand-700">All Offers <ArrowRight className="size-4" /></Link>
          </div>
          <ProductGrid products={offers} stock={stock} wishlist={wishlist} />
        </section>
      )}

      <section aria-labelledby="new-title">
        <div className="mb-5">
          <h2 id="new-title" className="text-2xl font-bold tracking-tight sm:text-3xl">New Arrivals</h2>
          <span className="mt-2 block h-1 w-12 rounded-full bg-brand-600" aria-hidden />
        </div>
        <ProductGrid products={newest} stock={stock} wishlist={wishlist} />
      </section>
    </div>
  );
}
