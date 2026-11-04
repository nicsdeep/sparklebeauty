"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, CircleCheck, CreditCard, FileText, Mail, Minus, Phone, Plus, ShieldCheck,
  ShoppingCart, Smartphone, Store, Trash2, Truck, User, Wallet, type LucideIcon,
} from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { SavingsNudge } from "@/components/shop/savings-nudge";
import { Button, ButtonLink, Field, cx, inputClass } from "@/components/ui";
import { MAX_LINE_QTY, useCart } from "@/lib/cart";
import { incentives } from "@/lib/incentives";
import { ruleLabel } from "@/lib/pricing";
import { useCheckoutState, type CheckoutState } from "@/lib/checkout-state";
import { deliverySummary } from "@/lib/store-types";
import { deliveryFee, kes, type PaymentMethod } from "@/lib/format";
import { payOrder, placeOrder } from "../actions";
import { demoSignIn } from "@/app/login/actions";
import { useStore } from "@/components/store-provider";
import { MpesaModal } from "@/components/shop/mpesa-modal";
import { OrderConfirmedModal } from "@/components/shop/order-confirmed-modal";

export type SavedAddress = { id: string; label: string; address_line1: string; address_line2: string | null; city: string; county: string | null; is_default: boolean };

const STEPS = [
  { id: "cart", label: "Cart" },
  { id: "details", label: "Your Details" },
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
  { id: "confirmation", label: "Confirmation" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const EMPTY_DELIVERY: NonNullable<CheckoutState["delivery"]> = { method: "delivery", address_line1: "", address_line2: "", city: "Nairobi", county: "Nairobi", notes: "", save: true };

export function CheckoutWizard({ profile, addresses }: {
  profile: { full_name: string; phone: string; email: string } | null;
  addresses: SavedAddress[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const step = (STEPS.find((s) => s.id === params.get("step"))?.id ?? "cart") as StepId;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const cart = useCart();
  const store = useStore();
  const [state, update, reset, loaded] = useCheckoutState();
  const [draftDelivery, setDraftDelivery] = useState<NonNullable<CheckoutState["delivery"]> | null>(null);

  const go = (id: StepId) => router.push(`/checkout?step=${id}`, { scroll: true });

  // Pre-fill from the signed-in customer's profile and default address (only fields not yet entered).
  useEffect(() => {
    if (!loaded || !profile) return;
    if (!state.contact) update({ contact: { full_name: profile.full_name, phone: profile.phone, email: profile.email } });
    if (!state.delivery) {
      const a = addresses.find((x) => x.is_default) ?? addresses[0];
      update({ delivery: a ? { ...EMPTY_DELIVERY, address_line1: a.address_line1, address_line2: a.address_line2 ?? "", city: a.city, county: a.county ?? "", save: false } : EMPTY_DELIVERY });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, profile]);

  if (!loaded || !cart.ready) return <div className="h-96" />;

  const placed = state.placed;
  if (!placed && cart.items.length === 0 && step !== "confirmation") {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <ButtonLink href="/shop" className="mt-4">Back to Shopping</ButtonLink>
      </div>
    );
  }

  const discount = state.discount ?? 0;
  // While the customer types an address the summary follows it (fee and free-delivery progress).
  const delivery = (step === "delivery" ? draftDelivery : null) ?? state.delivery ?? EMPTY_DELIVERY;
  const fee = deliveryFee(delivery.method, delivery, cart.subtotal - discount, store);
  const vat = cart.taxFor(discount, fee, store.vat_registered);
  const total = vat.total;
  const nudges = incentives(cart.items.map((i) => ({ name: i.name, quantity: i.quantity, breaks: cart.priceOf(i).breaks, available: cart.priceOf(i).available })),
    { method: delivery.method, address: delivery, amountAfterDiscount: cart.subtotal - discount, rules: store });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[34px] font-extrabold tracking-tight sm:text-[40px]" style={{ color: NAVY }}>Checkout</h1>
          <span className="mt-1 block h-1 w-16 rounded-full" style={{ background: PINK }} aria-hidden />
          <p className="mt-3 text-[16px] text-[#4B5563]">Complete your order in a few simple steps.</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#4B5563]">
            <ShieldCheck className="size-4 text-[#E6007E]" aria-hidden /> Secure checkout · M-Pesa · Card · Cash on delivery
          </p>
        </div>
        <ol className="grid flex-1 grid-cols-5 lg:max-w-[640px]" aria-label="Checkout steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className="relative flex flex-col items-center gap-2 text-center" aria-current={s.id === step ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={cx("absolute right-1/2 top-[19px] h-0.5 w-full", i <= stepIndex ? "bg-[#E6007E]" : "bg-[#E5E7EB]")} />}
              <span className={cx("relative z-10 flex size-10 items-center justify-center rounded-full text-[15px] font-bold",
                i < stepIndex ? "bg-[#E6007E] text-white" : i === stepIndex ? "bg-[#E6007E] text-white ring-[5px] ring-[#FCE7F3]" : "border-2 border-[#E5E7EB] bg-white text-[#6B7280]")}>
                {i < stepIndex ? <Check className="size-5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx("text-[12px] sm:text-[15px]", i === stepIndex ? "font-bold text-[#111827]" : "text-[#4B5563]")}>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {placed && step !== "confirmation" && step !== "payment" && (
        <p className="mb-5 rounded-xl bg-info-bg px-4 py-3 text-info-fg">
          Order <strong>{placed.orderNumber}</strong> has already been placed. {placed.paid ? <Link href={`/checkout?step=confirmation`} className="font-semibold underline">View confirmation</Link> : <Link href="/checkout?step=payment" className="font-semibold underline">Complete payment</Link>}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {step === "cart" && <CartStep onBack={() => router.push("/cart")} onNext={() => go("details")} />}
          {step === "details" && (profile
            ? <DetailsStep initial={state.contact ?? { full_name: profile.full_name, phone: profile.phone, email: profile.email }}
                onBack={() => go("cart")} onNext={(contact) => { update({ contact, mpesaPhone: state.mpesaPhone ?? contact.phone }); go("delivery"); }} />
            : <SignInStep onBack={() => go("cart")} />)}
          {step === "delivery" && (profile ? (
            <DeliveryStep initial={state.delivery ?? EMPTY_DELIVERY} addresses={addresses} onChange={setDraftDelivery}
              onBack={() => go("details")} onNext={(d) => { update({ delivery: d }); go("payment"); }} />
          ) : <SignInStep onBack={() => go("cart")} />)}
          {step === "payment" && (profile ? (
            <PaymentStep state={state} update={update} total={placed?.total ?? total} items={cart.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity }))}
              onBack={() => go("delivery")}
              onPaid={() => { cart.clear(); go("confirmation"); }} />
          ) : <SignInStep onBack={() => go("cart")} />)}
          {step === "confirmation" && <ConfirmationStep state={state} onDone={reset} />}
        </div>

        {step !== "confirmation" && (
          <aside className="h-fit space-y-4 rounded-3xl border border-[#F1E8EE] bg-white p-5 shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)] sm:p-6 lg:sticky lg:top-36">
            <h2 className="flex items-center gap-3 text-[22px] font-bold" style={{ color: NAVY }}>
              <span className="grid size-11 place-items-center rounded-xl bg-[#FDF2F8]"><FileText className="size-6" style={{ color: PINK }} strokeWidth={1.75} /></span> Order summary
            </h2>
            <ul className="space-y-2 border-b border-[#EEF0F3] pb-3 text-[15px] text-[#111827]">
              {cart.items.map((i) => (
                <li key={i.variantId} className="flex justify-between gap-3">
                  <span>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ""}</span>
                  <span className="font-semibold tabular-nums">{kes(cart.priceOf(i).unit * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 text-[16px] text-[#111827]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{kes(cart.subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-[#15803D]"><dt>Discount ({state.promoCode})</dt><dd className="tabular-nums">-{kes(discount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{stepIndex < 2 ? "Next step" : fee ? kes(fee) : "Free"}</dd></div>
              {store.vat_registered && <div className="flex justify-between"><dt>VAT</dt><dd className="tabular-nums">{kes(vat.tax)}</dd></div>}
            </dl>
            <div className="flex items-center justify-between rounded-full bg-[#FCE7F3] px-5 py-3.5">
              <span className="text-[20px] font-extrabold" style={{ color: NAVY }}>Total</span>
              <span className="text-[22px] font-extrabold tabular-nums" style={{ color: NAVY }}>{kes(placed?.total ?? total)}</span>
            </div>
            {!placed && <SavingsNudge value={stepIndex < 2 ? { ...nudges, delivery: null } : nudges} />}
            <div className="grid grid-cols-3 divide-x divide-[#F1E8EE] pt-1 text-center text-[12px] font-medium text-[#374151] sm:text-[13px]">
              {[{ Icon: ShieldCheck, text: "Secure Checkout" }, { Icon: Truck, text: "Reliable Delivery" }, { Icon: CreditCard, text: "Multiple Payment Options" }].map(({ Icon, text }) => (
                <span key={text} className="flex flex-col items-center gap-1 px-1"><Icon className="size-6" style={{ color: PINK }} strokeWidth={1.75} />{text}</span>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const PINK = "#E6007E";
const NAVY = "#0F1738";

function StepCard({ title, subtitle, Icon, children, footer }: { title: string; subtitle?: string; Icon: LucideIcon; children: ReactNode; footer: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#F1E8EE] bg-white p-5 shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)] sm:p-7">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#FDF2F8]"><Icon className="size-7" style={{ color: PINK }} strokeWidth={1.75} /></span>
        <div>
          <h2 className="text-[22px] font-bold sm:text-[26px]" style={{ color: NAVY }}>{title}</h2>
          {subtitle && <p className="text-[15px] text-[#4B5563]">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#EEF0F3] pt-5">{footer}</div>
    </section>
  );
}

const BackButton = ({ onClick, label = "Back" }: { onClick: () => void; label?: string }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-[16px] font-semibold text-[#111827] hover:underline"><ArrowLeft className="size-5" /> {label}</button>
);

/** Primary step action: Sparkle pink, rounded. */
const NextButton = ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
  <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={disabled}
    className="inline-flex h-13 items-center gap-2.5 rounded-full px-7 py-3.5 text-[16px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(230,0,126,0.7)] transition hover:opacity-90 disabled:opacity-50"
    style={{ background: PINK }}>{children}</button>
);

function CartStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { items, priceOf, setQuantity, remove, count } = useCart();
  return (
    <StepCard Icon={ShoppingCart} title="Review your cart" subtitle={`Your selected items (${count})`}
      footer={<><BackButton onClick={onBack} label="Back to Cart" /><NextButton onClick={onNext}>Next: Your Details <ArrowRight className="size-5" /></NextButton></>}>
      <ul className="space-y-3">
        {items.map((i) => {
          const p = priceOf(i);
          const label = ruleLabel(p.rule, p.minQty);
          return (
            <li key={i.variantId} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#F5E1EC] bg-[#FFFBFD] p-3 sm:flex-nowrap sm:p-4">
              <div className="w-20 shrink-0 sm:w-24"><ProductImage category={i.category} name={i.name} image={i.image} size="sm" className="rounded-xl" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold" style={{ color: NAVY }}>{i.name}</p>
                {i.variantName && <p className="text-[14px] text-[#6B7280]">{i.variantName}</p>}
                {p.available !== null && i.quantity > p.available
                  ? <p className="mt-1 text-[14px] font-semibold text-rose-fg">Only {p.available} available</p>
                  : <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-[#15803D]"><CircleCheck className="size-4" /> In stock – Ready to ship</p>}
                {label && <p className="mt-1.5 inline-flex rounded-full bg-[#E8F7EC] px-2.5 py-0.5 text-[12px] font-semibold text-[#15803D]">{label}</p>}
              </div>
              <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-white">
                  <button type="button" className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(i.variantId, i.quantity - 1)} disabled={i.quantity <= 1} aria-label={`Decrease ${i.name}`}><Minus className="size-4" /></button>
                  <span className="w-8 text-center font-semibold">{i.quantity}</span>
                  <button type="button" className="p-2.5 disabled:opacity-40" onClick={() => setQuantity(i.variantId, i.quantity + 1)} disabled={(p.available !== null && i.quantity >= p.available) || i.quantity >= MAX_LINE_QTY} aria-label={`Increase ${i.name}`}><Plus className="size-4" /></button>
                </div>
                <span className="min-w-24 text-right text-[17px] font-bold tabular-nums" style={{ color: NAVY }}>{kes(p.unit * i.quantity)}</span>
                <button type="button" onClick={() => remove(i.variantId)} className="flex flex-col items-center text-[12px] text-[#6B7280] hover:text-rose-fg" aria-label={`Remove ${i.name}`}><Trash2 className="size-[18px]" />Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
    </StepCard>
  );
}

function SignInStep({ onBack }: { onBack: () => void }) {
  return (
    <StepCard Icon={User} title="Sign in to continue" subtitle="So you can track your order and earn points." footer={<><BackButton onClick={onBack} /><span /></>}>
      <p className="text-ink-muted">Sign in so you can track your order and earn loyalty points. Your cart is saved.</p>
      <form action={demoSignIn}>
        <input type="hidden" name="account" value="customer" />
        <input type="hidden" name="next" value="/checkout?step=details" />
        <SubmitButton size="lg" className="w-full">Continue as Grace Achieng (demo)</SubmitButton>
      </form>
      <p className="text-center text-sm">or <Link href="/login?next=/checkout?step=details" className="font-semibold text-brand-700">sign in with email</Link></p>
    </StepCard>
  );
}

/** Text input with a leading icon. */
function IconInput({ Icon, onChange, ...props }: { Icon: LucideIcon; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <span className="relative block">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#6B7280]" strokeWidth={1.75} />
      <input {...props} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "pl-12")} />
    </span>
  );
}

function DetailsStep({ initial, onBack, onNext }: {
  initial: { full_name: string; phone: string; email: string };
  onBack: () => void;
  onNext: (c: { full_name: string; phone: string; email: string }) => void;
}) {
  const [c, setC] = useState(initial);
  const valid = c.full_name.trim().length > 1 && c.phone.replace(/\D/g, "").length >= 9;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onNext(c); };
  return (
    <form onSubmit={submit}>
      <StepCard Icon={User} title="Your details" subtitle="Tell us how to reach you for your order."
        footer={<><BackButton onClick={onBack} /><NextButton disabled={!valid}>Next: Delivery <ArrowRight className="size-5" /></NextButton></>}>
        <Field label="Full name"><IconInput Icon={User} value={c.full_name} onChange={(v) => setC({ ...c, full_name: v })} required autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" hint="For delivery updates and M-Pesa"><IconInput Icon={Phone} value={c.phone} onChange={(v) => setC({ ...c, phone: v })} required inputMode="tel" autoComplete="tel" /></Field>
          <Field label="Email"><IconInput Icon={Mail} type="email" value={c.email} onChange={(v) => setC({ ...c, email: v })} autoComplete="email" /></Field>
        </div>
      </StepCard>
    </form>
  );
}

function DeliveryStep({ initial, addresses, onChange, onBack, onNext }: {
  initial: NonNullable<CheckoutState["delivery"]>;
  addresses: SavedAddress[];
  /** Every edit, so the summary's delivery fee and free-delivery progress follow the address. */
  onChange: (d: NonNullable<CheckoutState["delivery"]>) => void;
  onBack: () => void;
  onNext: (d: NonNullable<CheckoutState["delivery"]>) => void;
}) {
  const store = useStore();
  const [d, setD] = useState(initial);
  const set = (patch: Partial<typeof d>) => { const next = { ...d, ...patch }; setD(next); onChange(next); };
  const valid = d.method === "pickup" || (d.address_line1.trim() && d.city.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) onNext(d); }}>
      <StepCard Icon={Truck} title="Delivery" subtitle="Choose how you'd like to receive your order."
        footer={<><BackButton onClick={onBack} /><NextButton disabled={!valid}>Next: Payment <ArrowRight className="size-5" /></NextButton></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { id: "delivery", Icon: Truck, title: "Home delivery", text: deliverySummary(store) },
            { id: "pickup", Icon: Store, title: "Pick up in store", text: `Free · ${store.address}` },
          ] as const).map(({ id, Icon, title, text }) => (
            <button type="button" key={id} onClick={() => set({ method: id })} aria-pressed={d.method === id}
              className={cx("flex gap-3.5 rounded-2xl border-2 p-4 text-left transition", d.method === id ? "border-[#E6007E] bg-[#FDF2F8]" : "border-[#EEF0F3] bg-white hover:border-[#F9A8D4]")}>
              <Icon className="mt-0.5 size-6 shrink-0" style={{ color: PINK }} strokeWidth={1.75} />
              <span><span className="block text-[17px] font-bold" style={{ color: NAVY }}>{title}</span><span className="block text-[14px] text-[#4B5563]">{text}</span></span>
            </button>
          ))}
        </div>
        {d.method === "delivery" && (
          <>
            {addresses.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Saved addresses</p>
                <div className="flex flex-wrap gap-2">
                  {addresses.map((a) => (
                    <button type="button" key={a.id} onClick={() => set({ address_line1: a.address_line1, address_line2: a.address_line2 ?? "", city: a.city, county: a.county ?? "", save: false })}
                      className={cx("rounded-xl border-2 px-4 py-2 text-left text-[15px]", d.address_line1 === a.address_line1 ? "border-[#E6007E] bg-[#FDF2F8]" : "border-[#EEF0F3]")}>
                      <strong>{a.label}</strong> · {a.address_line1}, {a.city}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Street address / estate"><input className={inputClass} value={d.address_line1} onChange={(e) => set({ address_line1: e.target.value })} required /></Field>
            <Field label="Building, floor or landmark (optional)"><input className={inputClass} value={d.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Town / city"><input className={inputClass} value={d.city} onChange={(e) => set({ city: e.target.value })} required /></Field>
              <Field label="County"><input className={inputClass} value={d.county} onChange={(e) => set({ county: e.target.value })} /></Field>
            </div>
            <Field label="Delivery notes (optional)"><input className={inputClass} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Call when at the gate" /></Field>
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" className="size-4 accent-brand-600" checked={d.save} onChange={(e) => set({ save: e.target.checked })} /> Save this address to my account
            </label>
          </>
        )}
      </StepCard>
    </form>
  );
}

function PaymentStep({ state, update, total, items, onBack, onPaid }: {
  state: CheckoutState;
  update: (p: Partial<CheckoutState>) => void;
  total: number;
  items: { variant_id: string; quantity: number }[];
  onBack: () => void;
  onPaid: () => void;
}) {
  const placed = state.placed;
  const [method, setMethod] = useState<PaymentMethod>(state.paymentMethod ?? "mpesa");
  const [phone, setPhone] = useState(state.mpesaPhone ?? state.contact?.phone ?? "");
  const [prompt, setPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lockedMethod = placed ? (state.paymentMethod ?? method) : method;
  const store = useStore();

  function finish(reference?: string) {
    update({ placed: { ...state.placed!, ...(placed ?? {}), paid: true, reference } as CheckoutState["placed"] });
    onPaid();
  }

  function submit() {
    setError(null);
    update({ paymentMethod: lockedMethod, mpesaPhone: phone });
    startTransition(async () => {
      let order = placed;
      if (!order) {
        const res = await placeOrder({
          items,
          contact: state.contact!,
          delivery: state.delivery!,
          paymentMethod: lockedMethod,
          promoCode: state.promoCode,
        });
        if (!res.ok) { setError(res.error); return; }
        order = { orderId: res.data.orderId, orderNumber: res.data.orderNumber, total: res.data.total, paid: false };
        update({ placed: order, paymentMethod: lockedMethod });
      }
      if (lockedMethod === "mpesa") { setPrompt(true); return; }
      if (lockedMethod === "card") {
        const pay = await payOrder(order.orderId);
        if (!pay.ok) { setError(pay.error); return; }
        update({ placed: { ...order, paid: true, reference: pay.data.reference } });
        onPaid();
        return;
      }
      update({ placed: { ...order, paid: true } });
      onPaid();
    });
  }

  if (placed?.paid && !prompt) {
    return (
      <StepCard Icon={Wallet} title="Payment" footer={<><BackButton onClick={onBack} /><NextButton onClick={() => finish(placed.reference)}>View Confirmation</NextButton></>}>
        <p>Order <strong>{placed.orderNumber}</strong> is already placed.</p>
      </StepCard>
    );
  }

  const options = [
    { id: "mpesa", Icon: Smartphone, title: "M-Pesa", text: "Pay with an M-Pesa prompt on your phone" },
    { id: "card", Icon: CreditCard, title: "Card", text: "Visa or Mastercard" },
    { id: "cash", Icon: Banknote, title: state.delivery?.method === "pickup" ? "Pay at the shop" : "Cash on delivery", text: "Pay when you receive your order" },
  ] as const;

  return (
    <>
      <StepCard Icon={Wallet} title="Payment" subtitle="Choose how you'd like to pay."
        footer={<><BackButton onClick={onBack} />
          <NextButton onClick={submit} disabled={pending || (lockedMethod === "mpesa" && phone.replace(/\D/g, "").length < 9)}>
            {pending ? "Please wait…" : lockedMethod === "cash" ? "Place Order" : lockedMethod === "card" ? `Pay ${kes(total)}` : `Pay ${kes(total)} with M-Pesa`}
          </NextButton></>}>
        {placed && <p className="rounded-xl bg-amber-bg px-4 py-3 text-amber-fg">Order <strong>{placed.orderNumber}</strong> is waiting for payment.</p>}
        <div className="grid gap-3" role="radiogroup" aria-label="Payment method">
          {options.map(({ id, Icon, title, text }) => (
            <button type="button" key={id} onClick={() => !placed && setMethod(id)} disabled={!!placed && id !== lockedMethod} role="radio" aria-checked={lockedMethod === id}
              className={cx("flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition disabled:opacity-40", lockedMethod === id ? "border-[#E6007E] bg-[#FDF2F8]" : "border-[#EEF0F3] bg-white hover:border-[#F9A8D4]")}>
              <Icon className="size-7 shrink-0 text-[#374151]" strokeWidth={1.5} />
              <span className="flex-1"><span className="block text-[17px] font-bold" style={{ color: NAVY }}>{title}</span><span className="block text-[14px] text-[#4B5563]">{text}</span></span>
              <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border-2", lockedMethod === id ? "border-[#E6007E]" : "border-[#C4C8CF]")} aria-hidden>
                {lockedMethod === id && <span className="size-3 rounded-full" style={{ background: PINK }} />}
              </span>
            </button>
          ))}
        </div>
        {lockedMethod === "mpesa" && (
          <Field label="M-Pesa phone number" hint="You'll get a prompt on this phone to enter your PIN.">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
        )}
        {lockedMethod === "card" && (
          <div className="grid gap-4 rounded-2xl bg-surface p-4 sm:grid-cols-3">
            <div className="sm:col-span-3"><Field label="Card number"><input className={inputClass} defaultValue="4242 4242 4242 4242" inputMode="numeric" /></Field></div>
            <Field label="Expiry"><input className={inputClass} defaultValue="12/28" /></Field>
            <Field label="CVC"><input className={inputClass} defaultValue="123" /></Field>
            <p className="text-sm text-ink-muted sm:col-span-3">Demo card payment. No money is charged.</p>
          </div>
        )}
        {error && <p className="rounded-xl bg-rose-bg px-4 py-3 text-rose-fg" role="alert">{error}</p>}
      </StepCard>

      {prompt && state.placed && (
        <MpesaModal orderId={state.placed.orderId} phone={phone} amount={state.placed.total} merchant={store.name}
          onPaid={(reference) => { update({ placed: { ...state.placed!, paid: true, reference } }); onPaid(); }}
          onClose={() => setPrompt(false)} />
      )}
    </>
  );
}

function ConfirmationStep({ state, onDone }: { state: CheckoutState; onDone: () => void }) {
  const placed = state.placed;
  const [open, setOpen] = useState(true);
  if (!placed) {
    return (
      <div className="rounded-2xl border border-line p-8 text-center">
        <p className="font-semibold">No order to show.</p>
        <ButtonLink href="/shop" className="mt-4">Continue Shopping</ButtonLink>
      </div>
    );
  }
  return (
    <>
      {/* Behind the modal, and what stays once it's closed. */}
      <section className="rounded-2xl border border-line p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-mint-fg" />
        <p className="mt-3 text-lg font-semibold">Order <span className="text-brand-700">{placed.orderNumber}</span> is confirmed.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => setOpen(true)}>View Confirmation</Button>
          <ButtonLink href={`/order/${placed.orderNumber}`} onClick={onDone}>View Order Details</ButtonLink>
        </div>
      </section>
      {open && (
        <OrderConfirmedModal firstName={state.contact?.full_name?.split(" ")[0]} orderNumber={placed.orderNumber} total={placed.total}
          method={state.paymentMethod ?? "mpesa"} reference={placed.reference}
          delivery={state.delivery?.method === "pickup" ? "Store pickup" : state.delivery?.city || "Delivery"}
          onClose={() => setOpen(false)} onDone={onDone} />
      )}
    </>
  );
}
