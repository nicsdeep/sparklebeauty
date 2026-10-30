import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Check, ChevronRight, Sparkles, Star, Store, Truck } from "lucide-react";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductMiniCard } from "@/components/shop/product-card";
import { ProductTabs, type ProductTab } from "@/components/shop/product-tabs";
import { ReviewForm } from "@/components/shop/review-form";
import { ShareButton } from "@/components/shop/share-button";
import { getProduct, getReviews, getStock, getWishlistIds, listProducts, reviewEligibility, type Review } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { deliverySummary } from "@/lib/store-types";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product?.name ?? "Product", description: product?.description ?? undefined };
}

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <span className="flex" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= Math.round(rating) ? `${size} fill-amber-400 text-amber-400` : `${size} text-line`} aria-hidden />
      ))}
    </span>
  );
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [store, wishlist, reviews, eligibility, sameCategory] = await Promise.all([
    getStoreSettings(),
    getWishlistIds(),
    getReviews(product.id),
    reviewEligibility(product.id, user?.id ?? null),
    listProducts({ category: product.category.slug }),
  ]);
  // Same category first, topped up from the parent department (e.g. other hair) if needed.
  let related = sameCategory.filter((p) => p.id !== product.id);
  if (related.length < 4 && product.category.parentSlug) {
    const more = await listProducts({ category: product.category.parentSlug });
    related = [...related, ...more.filter((p) => p.id !== product.id && !related.some((r) => r.id === p.id))];
  }
  related = related.slice(0, 4);
  const stock = await getStock([...product.variants, ...related.flatMap((p) => p.variants)].map((v) => v.id));

  const tabs: ProductTab[] = [
    {
      id: "description",
      label: "Description",
      content: (
        <div className="space-y-5 text-[16px] leading-relaxed text-ink-muted">
          <p>{product.description ?? `${product.name} from ${product.brand ?? "Sparkle"}.`}</p>
          {product.benefits.length > 0 && (
            <ul className="space-y-2.5">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Check className="size-3.5" strokeWidth={3} /></span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    ...(product.how_to_use ? [{ id: "how-to-use", label: "How to Use", content: <p className="text-[16px] leading-relaxed text-ink-muted">{product.how_to_use}</p> }] : []),
    ...(product.ingredients ? [{ id: "ingredients", label: "Ingredients", content: <p className="text-[16px] leading-relaxed text-ink-muted">{product.ingredients}</p> }] : []),
    {
      id: "reviews",
      label: product.review_count > 0 ? `Reviews (${product.review_count})` : "Reviews",
      content: <ReviewsPanel product={product} reviews={reviews} eligibility={eligibility} />,
    },
  ];

  return (
    <div className="space-y-10 lg:space-y-14">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-ink-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand-700">Home</Link><ChevronRight className="size-3.5" aria-hidden />
          <Link href="/shop" className="hover:text-brand-700">Shop</Link><ChevronRight className="size-3.5" aria-hidden />
          {product.category.parentSlug && (
            <><Link href={`/shop?category=${product.category.parentSlug}`} className="capitalize hover:text-brand-700">{product.category.parentSlug}</Link><ChevronRight className="size-3.5" aria-hidden /></>
          )}
          <Link href={`/shop?category=${product.category.slug}`} className="hover:text-brand-700">{product.category.name}</Link><ChevronRight className="size-3.5" aria-hidden />
          <span className="font-medium text-ink" aria-current="page">{product.name}</span>
        </nav>
        <ShareButton title={product.name} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <ProductGallery images={product.images} category={product.category.slug} name={product.name} />

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand-700">
            {product.brand}{product.brand && " · "}<span className="text-ink-muted">{product.category.name}</span>
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
            {product.review_count > 0 ? (
              <a href="#product-info" className="flex items-center gap-2 hover:text-brand-700">
                <Stars rating={product.rating} />
                <span className="font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-ink-muted">· {product.review_count} reviews</span>
              </a>
            ) : (
              <span className="text-ink-muted">No reviews yet</span>
            )}
            <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
            <span className="flex items-center gap-1.5 text-ink"><BadgeCheck className="size-5 text-mint-fg" aria-hidden /> 100% Original Product</span>
          </div>
          {product.description && <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{product.description}</p>}

          <div className="mt-6">
            <AddToCart product={product} stock={stock} wishlisted={wishlist.includes(product.id)} />
          </div>

          {product.benefits.length > 0 && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {product.benefits.slice(0, 3).map((b) => (
                <li key={b} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 text-[15px] font-semibold leading-snug">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><Sparkles className="size-5" aria-hidden /></span>
                  {b}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 grid gap-4 rounded-2xl bg-brand-50/70 p-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-brand-100 sm:p-5">
            <div className="flex gap-3 sm:pr-5">
              <Truck className="size-6 shrink-0 text-brand-600" aria-hidden />
              <p className="text-sm leading-relaxed"><strong className="text-[15px]">Delivery</strong><br /><span className="text-ink-muted">{deliverySummary(store)}.</span></p>
            </div>
            <div className="flex gap-3 sm:pl-5">
              <Store className="size-6 shrink-0 text-brand-600" aria-hidden />
              <p className="text-sm leading-relaxed"><strong className="text-[15px]">Free Pickup</strong><br /><span className="text-ink-muted">Collect from our shop in {store.address}. {store.hours}.</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-12">
        <section id="product-info" aria-label="Product information" className="scroll-mt-28">
          <ProductTabs tabs={tabs} />
        </section>
        {related.length > 0 && (
          <section aria-labelledby="related-title">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="related-title" className="text-2xl font-bold tracking-tight">You May Also Like</h2>
              <Link href={`/shop?category=${product.category.slug}`} className="flex items-center gap-1 font-semibold text-brand-700">View All <ArrowRight className="size-4" /></Link>
            </div>
            {/* Compact cards, one row of four: beside the tabs on wide screens (same height), below them otherwise. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {related.map((p) => <ProductMiniCard key={p.id} product={p} stock={stock} wishlisted={wishlist.includes(p.id)} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ReviewsPanel({ product, reviews, eligibility }: {
  product: { id: string; slug: string; rating: number; review_count: number };
  reviews: Review[];
  eligibility: Awaited<ReturnType<typeof reviewEligibility>>;
}) {
  return (
    <div className="space-y-6">
      {product.review_count > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-5xl font-extrabold tracking-tight">{product.rating.toFixed(1)}</span>
          <div>
            <Stars rating={product.rating} size="size-5" />
            <p className="mt-1 text-sm text-ink-muted">Based on {product.review_count} ratings</p>
          </div>
        </div>
      )}

      {reviews.length > 0 ? (
        <ul className="divide-y divide-line">
          {reviews.map((r) => (
            <li key={r.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars rating={r.rating} />
                <span className="font-semibold">{r.reviewer_name}</span>
                <span className="flex items-center gap-1 text-sm text-mint-fg"><BadgeCheck className="size-4" aria-hidden /> Verified buyer</span>
                <span className="text-sm text-ink-muted">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-2 leading-relaxed text-ink-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{product.review_count > 0 ? "No written reviews yet." : "No reviews yet. Be the first to review this product."}</p>
      )}

      {eligibility === "eligible" && <ReviewForm productId={product.id} slug={product.slug} />}
      {eligibility === "signin" && (
        <p className="text-sm text-ink-muted">
          Bought this? <Link href={`/login?next=/product/${product.slug}`} className="font-semibold text-brand-700">Sign in</Link> to write a review.
        </p>
      )}
      {eligibility === "not-bought" && <p className="text-sm text-ink-muted">You can review this product once an order with it has been delivered.</p>}
      {eligibility === "reviewed" && <p className="text-sm text-ink-muted">Thank you for reviewing this product.</p>}
    </div>
  );
}
