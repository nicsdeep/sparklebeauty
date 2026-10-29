import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, Truck, Store } from "lucide-react";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductGrid } from "@/components/shop/product-card";
import { ProductImage } from "@/components/shop/product-image";
import { getProduct, getStock, listProducts } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { STORE } from "@/lib/store";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const related = (await listProducts({ category: product.category.slug })).filter((p) => p.id !== product.id).slice(0, 4);
  const stock = await getStock([...product.variants, ...related.flatMap((p) => p.variants)].map((v) => v.id));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let wishlisted = false;
  if (user) {
    const { data } = await supabase.from("wishlist_items").select("product_id, wishlist:wishlists!inner(user_id)")
      .eq("product_id", product.id).eq("wishlist.user_id", user.id).maybeSingle();
    wishlisted = !!data;
  }

  return (
    <div className="space-y-14">
      <div>
        <nav className="mb-4 text-sm text-ink-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand-700">Home</Link> / <Link href="/shop" className="hover:text-brand-700">Shop</Link>
          {product.category.parentSlug && <> / <Link href={`/shop?category=${product.category.parentSlug}`} className="hover:text-brand-700 capitalize">{product.category.parentSlug}</Link></>}
          {" / "}<Link href={`/shop?category=${product.category.slug}`} className="hover:text-brand-700">{product.category.name}</Link>
        </nav>
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
          <ProductImage category={product.category.slug} name={product.name} image={product.image} size="lg" priority className="rounded-3xl" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{product.brand} · {product.category.name}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{product.name}</h1>
            <div className="mt-2 flex items-center gap-1.5 text-ink-muted">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span> · {product.review_count} reviews
            </div>
            {product.description && <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{product.description}</p>}
            <div className="mt-6">
              <AddToCart product={product} stock={stock} wishlisted={wishlisted} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-2xl border border-line p-4">
                <Truck className="size-5 shrink-0 text-brand-600" />
                <p className="text-sm"><strong>Delivery</strong><br />Nairobi KES 300, rest of Kenya KES 500. Free over KES 10,000.</p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-line p-4">
                <Store className="size-5 shrink-0 text-brand-600" />
                <p className="text-sm"><strong>Free pickup</strong><br />Collect from our shop in {STORE.address}, open daily 7am–8pm.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">You may also like</h2>
          <ProductGrid products={related} stock={stock} />
        </section>
      )}
    </div>
  );
}
