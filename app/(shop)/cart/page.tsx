"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, FileText, Headphones, Lock, Minus, Plus, ShieldCheck, ShoppingCart, Tag, Trash2, Truck } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { SavingsNudge } from "@/components/shop/savings-nudge";
import { ButtonLink, EmptyState, cx } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { deliveryFee, kes } from "@/lib/format";
import { incentives } from "@/lib/incentives";
import { useStore } from "@/components/store-provider";
import { checkPromo } from "../actions";
import { MAX_LINE_QTY } from "@/lib/cart";
import { ruleLabel } from "@/lib/pricing";
import { useCheckoutState } from "@/lib/checkout-state";

// Cart (Nicholas's design, 2026-11-04).

const PINK = "#E6007E";
const NAVY = "#0F1738";

export default function CartPage() {
  const { items, ready, setQuantity, remove, subtotal, priceOf, pricing, taxFor, count } = useCart();
  const [checkout, update] = useCheckoutState();
  const store = useStore();
  const [code, setCode] = useState(checkout.promoCode ?? "");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const discount = checkout.promoCode && checkout.discount && subtotal > 0 ? Math.min(checkout.discount, subtotal) : 0;
  // Before checkout the address isn't known: estimate for the saved delivery city, else Nairobi.
  const address = checkout.delivery?.method === "delivery" ? checkout.delivery : { city: "Nairobi" };
  const city = address.city || "Nairobi";
  const fee = deliveryFee("delivery", address, subtotal - discount, store);
  const vat = taxFor(discount, fee, store.vat_registered);
  const problems = items.filter((i) => { const a = priceOf(i).available; return a !== null && i.quantity > a; });
  const nudges = incentives(items.map((i) => ({ name: i.name, quantity: i.quantity, breaks: priceOf(i).breaks, available: priceOf(i).available })),
    { method: "delivery", address, amountAfterDiscount: subtotal - discount, rules: store });

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
    <div className="mx-auto max-w-7xl">
      <Link href="/shop" className="inline-flex items-center gap-2 text-[15px] font-medium text-[#111827] hover:underline"><ArrowLeft className="size-5" /> Continue Shopping</Link>
      <div className="mt-4 flex items-center gap-3">
        <ShoppingCart className="size-9 shrink-0" style={{ color: PINK }} strokeWidth={2.25} />
        <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[36px]" style={{ color: NAVY }}>Your Cart <span className="text-[20px] font-medium text-[#374151] sm:text-[24px]">({count} item{count === 1 ? "" : "s"})</span></h1>
      </div>
      <p className="mt-1 text-[16px] text-[#4B5563]">Review your items and proceed to checkout.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          <ul className="space-y-4">
            {items.map((item) => {
              const p = priceOf(item);
              const over = p.available !== null && item.quantity > p.available;
              const label = ruleLabel(p.rule, p.minQty);
              return (
                <li key={item.variantId} className="flex gap-4 rounded-3xl border border-[#F1E8EE] bg-white p-4 shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)] sm:gap-5 sm:p-5">
                  <Link href={`/product/${item.slug}`} className="w-24 shrink-0 sm:w-36">
                    <ProductImage category={item.category} name={item.name} image={item.image} size="sm" className="rounded-2xl" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <Link href={`/product/${item.slug}`} className="text-[17px] font-bold leading-snug hover:text-brand-700 sm:text-[19px]" style={{ color: NAVY }}>{item.name}</Link>
                      <div className="text-right">
                        <p className={cx("text-[18px] font-extrabold tabular-nums transition-opacity sm:text-[22px]", p.confirmed ? "" : "opacity-60")} style={{ color: PINK }}>{kes(p.unit * item.quantity)}</p>
                        {item.quantity > 1 && <p className="text-[13px] text-[#6B7280]">{kes(p.unit)} each{p.unit < p.retail && <span className="ml-1 line-through">{kes(p.retail)}</span>}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.variantName && <span className="rounded-full bg-[#FDF2F8] px-3 py-1 text-[13px] text-[#374151]">{item.variantName}</span>}
                      {label && <span className="rounded-full bg-[#E8F7EC] px-3 py-1 text-[13px] font-semibold text-[#15803D]">{label}</span>}
                    </div>
                    {over ? <p className="rounded-lg bg-rose-bg px-3 py-2 text-sm text-rose-fg">Only {p.available} available. Please reduce the quantity.</p>
                      : p.available !== null && p.available <= 5 ? <p className="text-[14px] font-semibold text-[#B45309]">Only {p.available} left</p>
                      : <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[#15803D]"><CircleCheck className="size-[18px]" /> In Stock</p>}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center rounded-full border border-[#E5E7EB] bg-white shadow-sm">
                        <button className="p-3 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name}`}><Minus className="size-4" /></button>
                        <span className="w-9 text-center text-[16px] font-semibold">{item.quantity}</span>
                        <button className="p-3 disabled:opacity-40" onClick={() => setQuantity(item.variantId, item.quantity + 1)} disabled={(p.available !== null && item.quantity >= p.available) || item.quantity >= MAX_LINE_QTY} aria-label={`Increase ${item.name}`}><Plus className="size-4" /></button>
                      </div>
                      <button onClick={() => remove(item.variantId)} className="flex items-center gap-1.5 text-[15px] font-medium text-[#6B7280] hover:text-rose-fg">
                        <Trash2 className="size-[18px]" /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="grid gap-4 rounded-3xl bg-[#FDF2F8] px-5 py-4 sm:grid-cols-3 sm:divide-x sm:divide-[#F3C6DC]">
            {[
              { Icon: Truck, title: "Fast Delivery", text: `Within ${city}` },
              { Icon: ShieldCheck, title: "Secure Checkout", text: "Your data is protected" },
              { Icon: Headphones, title: "Customer Support", text: "We're here to help" },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="flex items-center gap-3 sm:justify-center sm:px-3">
                <Icon className="size-8 shrink-0" style={{ color: PINK }} strokeWidth={1.75} />
                <div><p className="text-[15px] font-bold text-[#111827]">{title}</p><p className="text-[14px] text-[#4B5563]">{text}</p></div>
              </div>
            ))}
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-[#F1E8EE] bg-white p-5 shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)] sm:p-6 lg:sticky lg:top-36">
          <h2 className="flex items-center gap-3 text-[22px] font-bold" style={{ color: NAVY }}><FileText className="size-7" style={{ color: PINK }} strokeWidth={1.75} /> Order Summary</h2>
          <div className="flex gap-2">
            <label className="flex h-12 flex-1 items-center gap-2.5 rounded-full border border-[#E5E7EB] bg-white px-4 focus-within:border-[#E6007E]">
              <Tag className="size-[18px] shrink-0" style={{ color: PINK }} />
              <input className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#9CA3AF]" placeholder="Enter promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Promo code" />
            </label>
            <button onClick={applyPromo} disabled={!code.trim() || pending} className="h-12 rounded-full px-6 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: PINK }}>Apply</button>
          </div>
          {promoError && <p className="text-sm text-rose-fg">{promoError}</p>}
          {checkout.promoCode && discount > 0 && (
            <p className="flex justify-between rounded-xl bg-[#E8F7EC] px-3 py-2 text-sm text-[#15803D]">
              <span>✓ {checkout.promoCode} applied</span>
              <button className="font-semibold underline" onClick={() => { update({ promoCode: undefined, discount: undefined, promoLabel: undefined }); setCode(""); }}>Remove</button>
            </p>
          )}
          <dl className="space-y-2.5 text-[16px] text-[#111827]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className={cx("tabular-nums", pricing && "opacity-60")}>{kes(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-[#15803D]"><dt>Discount</dt><dd className="tabular-nums">-{kes(discount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery <span className="text-[#6B7280]">({city})</span></dt><dd className="tabular-nums">{fee ? kes(fee) : "Free"}</dd></div>
            {store.vat_registered && <div className="flex justify-between"><dt>VAT (16%)</dt><dd className={cx("tabular-nums", pricing && "opacity-60")}>{kes(vat.tax)}</dd></div>}
          </dl>
          <div className="flex items-center justify-between rounded-2xl bg-[#FCE7F3] px-4 py-3.5">
            <span className="text-[20px] font-extrabold" style={{ color: NAVY }}>Total</span>
            <span className="text-[22px] font-extrabold tabular-nums" style={{ color: PINK }}>{kes(vat.total)}</span>
          </div>
          <SavingsNudge value={nudges} />
          <ButtonLink href="/checkout" size="lg" className={cx("h-14 w-full gap-3 text-[17px]", problems.length > 0 && "pointer-events-none opacity-50")} aria-disabled={problems.length > 0}>
            <Lock className="size-5" /> Proceed to Checkout <ArrowRight className="size-5" />
          </ButtonLink>
          <Link href="/shop" className="flex items-center justify-center gap-2 text-[16px] font-semibold" style={{ color: PINK }}><ArrowLeft className="size-4" /> Back to Shopping</Link>
        </aside>
      </div>
    </div>
  );
}
