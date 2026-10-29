"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { Button, ButtonLink, EmptyState, inputClass } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { deliveryFee, FREE_DELIVERY_THRESHOLD, kes } from "@/lib/format";
import { checkPromo, quoteCart } from "../actions";
import { useCheckoutState } from "@/lib/checkout-state";

export default function CartPage() {
  const { items, ready, setQuantity, remove, subtotal } = useCart();
  const [quotes, setQuotes] = useState<Record<string, { price: number; available: number; low: boolean }>>({});
  const [checkout, update] = useCheckoutState();
  const [code, setCode] = useState(checkout.promoCode ?? "");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ids = items.map((i) => i.variantId).join(",");
  useEffect(() => {
    if (!ids) return;
    quoteCart(ids.split(",")).then(setQuotes);
  }, [ids]);

  const discount = checkout.promoCode && checkout.discount && subtotal > 0 ? Math.min(checkout.discount, subtotal) : 0;
  const fee = deliveryFee("delivery", "Nairobi", subtotal - discount);
  const problems = items.filter((i) => quotes[i.variantId] && i.quantity > quotes[i.variantId].available);

  function applyPromo() {
    setPromoError(null);
    startTransition(async () => {
      const res = await checkPromo(code, subtotal);
      if (res.ok) update({ promoCode: res.data.code, discount: res.data.discount, promoLabel: res.data.label });
      else {
        setPromoError(res.error);
        update({ promoCode: undefined, discount: undefined, promoLabel: undefined });
      }
    });
  }

  // Re-validate the promo when the subtotal changes.
  useEffect(() => {
    if (!checkout.promoCode || !ready) return;
    checkPromo(checkout.promoCode, subtotal).then((res) => {
      if (res.ok) update({ discount: res.data.discount });
      else { setPromoError(res.error); update({ promoCode: undefined, discount: undefined, promoLabel: undefined }); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, ready]);

  if (!ready) return <div className="h-64" />;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <EmptyState title="Your cart is empty">
          <p>Find something you love.</p>
          <ButtonLink href="/shop" className="mt-4">Start Shopping</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Your cart</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {items.map((item) => {
            const q = quotes[item.variantId];
            const over = q && item.quantity > q.available;
            return (
              <li key={item.variantId} className="flex gap-4 p-4">
                <Link href={`/product/${item.slug}`} className="w-24 shrink-0 sm:w-28">
                  <ProductImage category={item.category} name={item.name} image={item.image} size="sm" />
                </Link>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-3">
                    <div>
                      <Link href={`/product/${item.slug}`} className="font-semibold hover:text-brand-700">{item.name}</Link>
                      {item.variantName && <p className="text-sm text-ink-muted">{item.variantName}</p>}
                      <p className="text-sm text-ink-muted">{kes(item.price)} each</p>
                    </div>
                    <p className="font-bold">{kes(item.price * item.quantity)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-line">
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name}`}><Minus className="size-4" /></button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity + 1)} disabled={!!q && item.quantity >= q.available} aria-label={`Increase ${item.name}`}><Plus className="size-4" /></button>
                    </div>
                    <button onClick={() => remove(item.variantId)} className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-rose-fg">
                      <Trash2 className="size-4" /> Remove
                    </button>
                  </div>
                  {over && <p className="rounded-lg bg-rose-bg px-3 py-2 text-sm text-rose-fg">Only {q.available} available. Please reduce the quantity.</p>}
                  {!over && q?.low && <p className="text-sm font-semibold text-amber-fg">! Low stock: only {q.available} left</p>}
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit space-y-4 rounded-2xl border border-line p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="flex gap-2">
            <input className={inputClass} placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Promo code" />
            <Button variant="secondary" onClick={applyPromo} disabled={!code.trim() || pending}>Apply</Button>
          </div>
          {promoError && <p className="text-sm text-rose-fg">{promoError}</p>}
          {checkout.promoCode && discount > 0 && (
            <p className="flex justify-between rounded-lg bg-mint-bg px-3 py-2 text-sm text-mint-fg">
              <span>✓ {checkout.promoCode} applied</span>
              <button className="font-semibold underline" onClick={() => { update({ promoCode: undefined, discount: undefined, promoLabel: undefined }); setCode(""); }}>Remove</button>
            </p>
          )}
          <dl className="space-y-2 text-[15px]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{kes(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount</dt><dd>-{kes(discount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery <span className="text-ink-muted">(Nairobi)</span></dt><dd>{fee ? kes(fee) : "Free"}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold"><dt>Total</dt><dd>{kes(subtotal - discount + fee)}</dd></div>
          </dl>
          <p className="text-sm text-ink-muted">
            {subtotal - discount >= FREE_DELIVERY_THRESHOLD ? "You qualify for free delivery." : `Add ${kes(FREE_DELIVERY_THRESHOLD - (subtotal - discount))} more for free delivery. Outside Nairobi KES 500. Pickup is free.`}
          </p>
          <ButtonLink href="/checkout" size="lg" className={problems.length ? "pointer-events-none w-full opacity-50" : "w-full"} aria-disabled={problems.length > 0}>
            Proceed to Checkout
          </ButtonLink>
          <Link href="/shop" className="flex items-center justify-center gap-2 font-semibold text-brand-700"><ArrowLeft className="size-4" /> Back to Shopping</Link>
        </aside>
      </div>
    </div>
  );
}
