"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, CreditCard, Smartphone, Store, Truck } from "lucide-react";
import { ProductImage } from "@/components/shop/product-image";
import { Button, ButtonLink, Field, cx, inputClass } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { useCheckoutState, type CheckoutState } from "@/lib/checkout-state";
import { deliveryFee, kes, maskPhone, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import { payOrder, placeOrder } from "../actions";
import { demoSignIn } from "@/app/login/actions";
import { STORE } from "@/lib/store";

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
  const [state, update, reset, loaded] = useCheckoutState();

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
  const delivery = state.delivery ?? EMPTY_DELIVERY;
  const fee = deliveryFee(delivery.method, delivery.city, cart.subtotal - discount);
  const total = cart.subtotal - discount + fee;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>
      <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-col items-center gap-2 text-center" aria-current={s.id === step ? "step" : undefined}>
            <span className={cx("flex size-9 items-center justify-center rounded-full text-sm font-bold",
              i < stepIndex ? "bg-brand-600 text-white" : i === stepIndex ? "border-2 border-brand-600 bg-brand-50 text-brand-700" : "bg-surface text-ink-muted")}>
              {i < stepIndex ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cx("text-xs font-semibold sm:text-sm", i === stepIndex ? "text-ink" : "text-ink-muted")}>{s.label}</span>
          </li>
        ))}
      </ol>

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
            <DeliveryStep initial={delivery} addresses={addresses}
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
          <aside className="h-fit space-y-3 rounded-2xl border border-line p-5 lg:sticky lg:top-36">
            <h2 className="font-semibold">Order summary</h2>
            <ul className="space-y-2 text-sm">
              {cart.items.map((i) => (
                <li key={i.variantId} className="flex justify-between gap-3">
                  <span>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ""}</span>
                  <span className="font-semibold">{kes(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line pt-3 text-[15px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{kes(cart.subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount ({state.promoCode})</dt><dd>-{kes(discount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{stepIndex < 2 ? "Next step" : fee ? kes(fee) : "Free"}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{kes(placed?.total ?? total)}</dd></div>
            </dl>
          </aside>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line">
      <h2 className="border-b border-line px-5 py-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-4 p-5">{children}</div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">{footer}</div>
    </section>
  );
}

const BackButton = ({ onClick, label = "Back" }: { onClick: () => void; label?: string }) => (
  <Button type="button" variant="ghost" onClick={onClick}><ArrowLeft className="size-4" /> {label}</Button>
);

function CartStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { items } = useCart();
  return (
    <StepCard title="Review your cart" footer={<><BackButton onClick={onBack} label="Back to Cart" /><Button onClick={onNext}>Next: Your Details <ArrowRight className="size-4" /></Button></>}>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.variantId} className="flex items-center gap-4 py-3">
            <div className="w-16"><ProductImage category={i.category} name={i.name} size="sm" /></div>
            <div className="flex-1">
              <p className="font-semibold">{i.name}</p>
              <p className="text-sm text-ink-muted">{i.variantName ? `${i.variantName} · ` : ""}Qty {i.quantity}</p>
            </div>
            <p className="font-semibold">{kes(i.price * i.quantity)}</p>
          </li>
        ))}
      </ul>
    </StepCard>
  );
}

function SignInStep({ onBack }: { onBack: () => void }) {
  return (
    <StepCard title="Sign in to continue" footer={<><BackButton onClick={onBack} /><span /></>}>
      <p className="text-ink-muted">Sign in so you can track your order and earn loyalty points. Your cart is saved.</p>
      <form action={demoSignIn}>
        <input type="hidden" name="account" value="customer" />
        <input type="hidden" name="next" value="/checkout?step=details" />
        <Button size="lg" className="w-full">Continue as Grace Achieng (demo)</Button>
      </form>
      <p className="text-center text-sm">or <Link href="/login?next=/checkout?step=details" className="font-semibold text-brand-700">sign in with email</Link></p>
    </StepCard>
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
      <StepCard title="Your details" footer={<><BackButton onClick={onBack} /><Button disabled={!valid}>Next: Delivery <ArrowRight className="size-4" /></Button></>}>
        <Field label="Full name"><input className={inputClass} value={c.full_name} onChange={(e) => setC({ ...c, full_name: e.target.value })} required autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" hint="For delivery updates and M-Pesa"><input className={inputClass} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} required inputMode="tel" autoComplete="tel" /></Field>
          <Field label="Email"><input className={inputClass} type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} autoComplete="email" /></Field>
        </div>
      </StepCard>
    </form>
  );
}

function DeliveryStep({ initial, addresses, onBack, onNext }: {
  initial: NonNullable<CheckoutState["delivery"]>;
  addresses: SavedAddress[];
  onBack: () => void;
  onNext: (d: NonNullable<CheckoutState["delivery"]>) => void;
}) {
  const [d, setD] = useState(initial);
  const set = (patch: Partial<typeof d>) => setD({ ...d, ...patch });
  const valid = d.method === "pickup" || (d.address_line1.trim() && d.city.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) onNext(d); }}>
      <StepCard title="Delivery" footer={<><BackButton onClick={onBack} /><Button disabled={!valid}>Next: Payment <ArrowRight className="size-4" /></Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { id: "delivery", Icon: Truck, title: "Home delivery", text: "Nairobi KES 300 · elsewhere KES 500 · free over KES 10,000" },
            { id: "pickup", Icon: Store, title: "Pick up in store", text: `Free · ${STORE.address}` },
          ] as const).map(({ id, Icon, title, text }) => (
            <button type="button" key={id} onClick={() => set({ method: id })} aria-pressed={d.method === id}
              className={cx("flex gap-3 rounded-2xl border p-4 text-left", d.method === id ? "border-brand-600 bg-brand-50" : "border-line hover:border-brand-200")}>
              <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <span><span className="block font-semibold">{title}</span><span className="block text-sm text-ink-muted">{text}</span></span>
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
                      className={cx("rounded-xl border px-3 py-2 text-left text-sm", d.address_line1 === a.address_line1 ? "border-brand-600 bg-brand-50" : "border-line")}>
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

  function simulateMpesa() {
    startTransition(async () => {
      const pay = await payOrder(state.placed!.orderId, phone);
      if (!pay.ok) { setError(pay.error); setPrompt(false); return; }
      setPrompt(false);
      update({ placed: { ...state.placed!, paid: true, reference: pay.data.reference } });
      onPaid();
    });
  }

  if (placed?.paid) {
    return (
      <StepCard title="Payment" footer={<><BackButton onClick={onBack} /><Button onClick={() => finish(placed.reference)}>View Confirmation</Button></>}>
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
      <StepCard title="Payment"
        footer={<><BackButton onClick={onBack} />
          <Button size="lg" onClick={submit} disabled={pending || (lockedMethod === "mpesa" && phone.replace(/\D/g, "").length < 9)}>
            {pending ? "Please wait…" : lockedMethod === "cash" ? "Place Order" : lockedMethod === "card" ? `Pay ${kes(total)}` : `Pay ${kes(total)} with M-Pesa`}
          </Button></>}>
        {placed && <p className="rounded-xl bg-amber-bg px-4 py-3 text-amber-fg">Order <strong>{placed.orderNumber}</strong> is waiting for payment.</p>}
        <div className="grid gap-3">
          {options.map(({ id, Icon, title, text }) => (
            <button type="button" key={id} onClick={() => !placed && setMethod(id)} disabled={!!placed && id !== lockedMethod} aria-pressed={lockedMethod === id}
              className={cx("flex items-center gap-3 rounded-2xl border p-4 text-left disabled:opacity-40", lockedMethod === id ? "border-brand-600 bg-brand-50" : "border-line hover:border-brand-200")}>
              <Icon className="size-6 shrink-0 text-brand-600" />
              <span><span className="block font-semibold">{title}</span><span className="block text-sm text-ink-muted">{text}</span></span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="mpesa-title">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-bg text-mint-fg"><Smartphone className="size-7" /></span>
            <h3 id="mpesa-title" className="mt-4 text-xl font-bold">Check your phone</h3>
            <p className="mt-2 text-ink-muted">
              An M-Pesa payment request has been sent to <strong className="text-ink">{maskPhone(phone)}</strong>.
              Enter your M-Pesa PIN to pay <strong className="text-ink">{kes(state.placed.total)}</strong> to Sparkle Beauty.
            </p>
            <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-ink-muted">Demo mode: no real M-Pesa request is sent.</p>
            <Button size="lg" className="mt-5 w-full" onClick={simulateMpesa} disabled={pending}>
              {pending ? "Confirming…" : "Simulate Successful Payment"}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setPrompt(false)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmationStep({ state, onDone }: { state: CheckoutState; onDone: () => void }) {
  const placed = state.placed;
  if (!placed) {
    return (
      <div className="rounded-2xl border border-line p-8 text-center">
        <p className="font-semibold">No order to show.</p>
        <ButtonLink href="/shop" className="mt-4">Continue Shopping</ButtonLink>
      </div>
    );
  }
  const method = state.paymentMethod ?? "mpesa";
  return (
    <section className="rounded-2xl border border-line p-8 text-center">
      <CheckCircle2 className="mx-auto size-16 text-mint-fg" />
      <h2 className="mt-4 text-2xl font-bold">Thank you{state.contact?.full_name ? `, ${state.contact.full_name.split(" ")[0]}` : ""}! Your order is confirmed.</h2>
      <p className="mt-2 text-ink-muted">Order number</p>
      <p className="text-3xl font-extrabold tracking-wide text-brand-700">{placed.orderNumber}</p>
      <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 rounded-2xl bg-surface p-4 text-left text-[15px]">
        <dt className="text-ink-muted">Total</dt><dd className="text-right font-semibold">{kes(placed.total)}</dd>
        <dt className="text-ink-muted">Payment</dt>
        <dd className="text-right font-semibold">{PAYMENT_LABEL[method]}{method === "cash" ? " (on delivery)" : " · Paid"}</dd>
        {placed.reference && <><dt className="text-ink-muted">Reference</dt><dd className="text-right font-mono font-semibold">{placed.reference}</dd></>}
        <dt className="text-ink-muted">Delivery</dt><dd className="text-right font-semibold">{state.delivery?.method === "pickup" ? "Store pickup" : state.delivery?.city}</dd>
      </dl>
      <p className="mt-4 text-ink-muted">We&apos;ll send updates by SMS and to your account notifications.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/order/${placed.orderNumber}`} size="lg" onClick={onDone}>Track Order</ButtonLink>
        <ButtonLink href="/shop" size="lg" variant="secondary" onClick={onDone}>Continue Shopping</ButtonLink>
      </div>
    </section>
  );
}
