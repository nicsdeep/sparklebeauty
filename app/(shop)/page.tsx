import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid } from "@/components/shop/product-card";
import { ProductImage } from "@/components/shop/product-image";
import { ButtonLink } from "@/components/ui";
import { getStock, listProducts } from "@/lib/catalog";

const DEPARTMENTS = [
  { slug: "wigs", name: "Wigs" },
  { slug: "braids", name: "Braids" },
  { slug: "extensions", name: "Extensions" },
  { slug: "cosmetics", name: "Cosmetics" },
  { slug: "skincare", name: "Skincare" },
  { slug: "perfumes", name: "Perfumes" },
];

export default async function HomePage() {
  const [featured, newest, offers] = await Promise.all([
    listProducts({ featured: true, limit: 8 }),
    listProducts({ sort: "newest", limit: 4 }),
    listProducts({ offers: true, limit: 4 }),
  ]);
  const stock = await getStock([...featured, ...newest, ...offers].flatMap((p) => p.variants.map((v) => v.id)));

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-6 overflow-hidden rounded-3xl bg-brand-50 p-6 sm:p-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Wigs · Braids · Beauty</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Look good, feel good, <span className="text-brand-600">be you.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-muted">
            Original wigs, braids and beauty brands at Nairobi prices. Order online, pay with M-Pesa, and get it delivered.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/shop" size="lg">Shop Now <ArrowRight className="size-5" /></ButtonLink>
            <ButtonLink href="/shop?category=wigs" variant="secondary" size="lg">Browse Wigs</ButtonLink>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {featured.slice(0, 4).map((p) => (
            <Link key={p.id} href={`/product/${p.slug}`} className="rounded-2xl bg-white p-2">
              <ProductImage category={p.category.slug} name={p.name} brand={p.brand} size="sm" />
              <p className="mt-2 truncate px-1 text-sm font-semibold">{p.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { Icon: BadgeCheck, title: "100% original products", text: "Authentic, trusted brands" },
          { Icon: Truck, title: "Fast delivery", text: "Nairobi KES 300 · free over KES 10,000" },
          { Icon: ShieldCheck, title: "Secure payments", text: "M-Pesa, card or cash on delivery" },
          { Icon: MessageCircle, title: "Help on WhatsApp", text: "0702 388 724, 8am–8pm daily" },
        ].map(({ Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <span className="rounded-full bg-brand-50 p-2.5 text-brand-600"><Icon className="size-5" /></span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Shop by category</h2>
          <Link href="/shop" className="font-semibold text-brand-700">View all</Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {DEPARTMENTS.map((d) => (
            <Link key={d.slug} href={`/shop?category=${d.slug}`} className="rounded-2xl border border-line p-2 text-center hover:border-brand-200">
              <ProductImage category={d.slug} name={d.name} size="sm" />
              <p className="mt-2 font-semibold">{d.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Featured products</h2>
          <Link href="/shop" className="font-semibold text-brand-700">View all</Link>
        </div>
        <ProductGrid products={featured} stock={stock} />
      </section>

      {offers.length > 0 && (
        <section className="rounded-3xl bg-surface p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold">Special offers</h2>
              <p className="text-ink-muted">Use code <strong className="text-brand-700">SPARKLE10</strong> for 10% off orders over KES 3,000.</p>
            </div>
            <Link href="/shop?offers=1" className="font-semibold text-brand-700">All offers</Link>
          </div>
          <ProductGrid products={offers} stock={stock} />
        </section>
      )}

      <section>
        <h2 className="mb-4 text-2xl font-bold">New arrivals</h2>
        <ProductGrid products={newest} stock={stock} />
      </section>
    </div>
  );
}
