"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { Button, ButtonLink, EmptyState, inputClass } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { deliveryFee, kes } from "@/lib/format";
import { useStore } from "@/components/store-provider";
import { checkPromo } from "../actions";
import { MAX_LINE_QTY } from "@/lib/cart";
import { ruleLabel } from "@/lib/pricing";
import { useCheckoutState } from "@/lib/checkout-state";

export default function CartPage() {
  const { items, ready, setQuantity, remove, subtotal, priceOf, pricing } = useCart();
  const [checkout, update] = useCheckoutState();
  const store = useStore();
  const freeOver = store.free_delivery_threshold;
  const [code, setCode] = useState(checkout.promoCode ?? "");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const discount = checkout.promoCode && checkout.discount && subtotal > 0 ? Math.min(checkout.discount, subtotal) : 0;
  const fee = deliveryFee("delivery", { city: "Nairobi" }, subtotal - discount, store);
  const problems = items.filter((i) => { const a = priceOf(i).available; return a !== null && i.quantity > a; });

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
            const p = priceOf(item);
            const over = p.available !== null && item.quantity > p.available;
            const label = ruleLabel(p.rule, p.minQty);
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
                      <p className="text-sm text-ink-muted">
                        {kes(p.unit)} each{p.unit < p.retail && <span className="ml-1.5 line-through">{kes(p.retail)}</span>}
                      </p>
                      {label && <p className="mt-1 inline-flex rounded-full bg-teal-bg px-2.5 py-0.5 text-xs font-semibold text-teal-fg">{label}</p>}
                    </div>
                    <p className={`font-bold transition-opacity ${p.confirmed ? "" : "opacity-60"}`}>{kes(p.unit * item.quantity)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-line">
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name}`}><Minus className="size-4" /></button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity + 1)} disabled={(p.available !== null && item.quantity >= p.available) || item.quantity >= MAX_LINE_QTY} aria-label={`Increase ${item.name}`}><Plus className="size-4" /></button>
                    </div>
                    <button onClick={() => remove(item.variantId)} className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-rose-fg">
                      <Trash2 className="size-4" /> Remove
                    </button>
                  </div>
                  {over && <p className="rounded-lg bg-rose-bg px-3 py-2 text-sm text-rose-fg">Only {p.available} available. Please reduce the quantity.</p>}
                  {!over && p.available !== null && p.available <= 5 && <p className="text-sm font-semibold text-amber-fg">! Low stock: only {p.available} left</p>}
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
            <div className="flex justify-between"><dt>Subtotal</dt><dd className={pricing ? "opacity-60" : ""}>{kes(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount</dt><dd>-{kes(discount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery <span className="text-ink-muted">(Nairobi)</span></dt><dd>{fee ? kes(fee) : "Free"}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold"><dt>Total</dt><dd>{kes(subtotal - discount + fee)}</dd></div>
          </dl>
          <p className="text-sm text-ink-muted">
            {subtotal - discount >= freeOver ? "You qualify for free delivery." : `Add ${kes(freeOver - (subtotal - discount))} more for free delivery. Outside Nairobi ${kes(store.delivery_fee_other)}. Pickup is free.`}
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
