import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Check, CircleCheck, Clock, FileText, Headphones, Info, MapPin, Package, ShoppingBag, Store, Truck, X } from "lucide-react";
import { LiveOrder } from "@/components/shop/live-order";
import { OrderTimeline } from "@/components/order-timeline";
import { ProductImage } from "@/components/shop/product-image";
import { cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store";
import { formatDateTime, formatDateTimeFull, type OrderStatus } from "@/lib/format";
import { customerStages, InfoRow, loadCustomerOrder, NAVY, Panel, PINK, stageTimes, statusLabel, variantTags } from "../order-data";

// Customer order tracking (Nicholas's design, 2026-11-03). Refreshes itself while open.

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Track order ${(await params).number}` };
}

const TZ = "Africa/Nairobi";
/** "Nov 3, 2026" */
const longDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
/** "6:00 PM" */
const clock = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

type Banner = { eyebrow?: string; title: string; time?: string; line?: string; next: string };

/** The banner text and "what's next" for where the order is, from the order's real data. */
function banner(status: OrderStatus, pickup: boolean, eta: string | null, doneAt?: string): Banner {
  switch (status) {
    case "pending": return { title: "Waiting for payment", line: "Complete your M-Pesa payment and we'll start on your order.", next: "Once your payment is in, we'll confirm your order and start preparing it." };
    case "confirmed": case "paid": return { title: "Order confirmed", line: "We've received your order.", next: "Our team will start preparing your order shortly." };
    case "processing": return { title: "Preparing your order", line: "We're getting your items ready.", next: pickup ? "We'll let you know as soon as it's ready to collect." : "Once it's packed, it goes to our rider." };
    case "packed": return pickup
      ? { title: "Ready for pickup", line: "Your order is waiting for you at the shop.", next: "Come to the shop with your order number to collect it." }
      : { title: "Preparing your order", line: "Your order is packed and will be on its way soon.", next: "Our rider will pick it up and bring it to you." };
    case "dispatched":
      if (pickup) return { title: "Ready for pickup", line: "Your order is waiting for you at the shop.", next: "Come to the shop with your order number to collect it." };
      return eta
        ? { eyebrow: "Estimated Delivery", title: longDate(eta), time: `By ${clock(eta)}`, next: "Our rider is on the way to your delivery address. Keep your phone close." }
        : { title: "Out for Delivery", line: "Our rider is on the way to you.", next: "Our rider is on the way to your delivery address. Keep your phone close." };
    case "delivered": case "completed": return {
      title: pickup ? "Collected" : "Delivered",
      line: doneAt ? `${pickup ? "Collected" : "Delivered"} ${longDate(doneAt)} at ${clock(doneAt)}.` : "Your order is complete.",
      next: "Enjoy your Sparkle goodies! We'd love to see you again.",
    };
    case "cancelled": return { title: "Cancelled", line: "This order was cancelled.", next: "Contact us if you have any questions about this order." };
    default: return { title: statusLabel(status), next: "Contact us if you have any questions about this order." };
  }
}

const RIDER = "/brand/delivery-rider-banner.webp";
/** The rider image's own background colour at its left edge, so the banner and image meet seamlessly. */
const BANNER_BG = "#FBE5F1";

export default async function TrackOrderPage({ params }: Params) {
  const { number } = await params;
  await requireUser(`/order/${number}/track`);
  const store = await getStoreSettings();
  const { order, items, events, pickup, status, address, plainHistory } = await loadCustomerOrder(number);
  const stages = customerStages(pickup);
  const times = stageTimes(stages, events, order.created_at);
  const reached = stages.findIndex((s) => s.statuses.includes(status));
  const now = banner(status, pickup, order.estimated_delivery_at, times[stages.length - 1]);
  const cancelled = status === "cancelled";
  const methodLabel = pickup ? "Store Pickup" : "Standard Delivery";

  return (
    <div className="mx-auto max-w-7xl">
      <LiveOrder orderId={order.id} />
      <Link href={`/order/${order.order_number}`} className="inline-flex items-center gap-2 text-[15px] font-medium text-[#111827] hover:underline"><ArrowLeft className="size-5" /> Back</Link>
      <h1 className="mt-3 text-[30px] font-extrabold tracking-tight sm:text-[36px]" style={{ color: NAVY }}>Track Order</h1>
      <p className="mt-1 text-[16px] text-[#4B5563]">Follow your order in real time.</p>

      {/* Summary strip */}
      <div className="mt-6 grid grid-cols-2 gap-y-5 rounded-3xl bg-gradient-to-r from-[#FDF2F8] to-[#FCE7F3] px-5 py-5 lg:grid-cols-4 lg:divide-x lg:divide-[#F3C6DC] lg:px-2">
        <div className="flex items-center gap-3 lg:px-6">
          <ShoppingBag className="hidden size-8 shrink-0 sm:block" style={{ color: PINK }} strokeWidth={1.5} />
          <div><p className="text-[14px] text-[#374151]">Order Number</p><p className="text-[22px] font-extrabold tracking-wide sm:text-[26px]" style={{ color: PINK }}>{order.order_number}</p></div>
        </div>
        <div className="flex items-center gap-3 lg:px-6">
          <CalendarDays className="hidden size-7 shrink-0 sm:block" style={{ color: PINK }} strokeWidth={1.5} />
          <div><p className="text-[14px] text-[#374151]">Order Date</p><p className="text-[15px] font-semibold text-[#111827] sm:text-[16px]">{formatDateTimeFull(order.created_at)}</p></div>
        </div>
        <div className="lg:px-6">
          <p className="text-[14px] text-[#374151]">Current Status</p>
          <span className={cx("mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[15px] font-semibold",
            cancelled ? "bg-[#FDECEC] text-[#B91C1C]" : status === "pending" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#DCF5E3] text-[#15803D]")}>
            {cancelled ? <X className="size-4" /> : status === "dispatched" && !pickup ? <Truck className="size-[18px]" /> : <CircleCheck className="size-[18px]" />}
            {cancelled ? "Cancelled" : reached >= 0 ? (reached === 0 && status === "pending" ? "Awaiting payment" : stages[reached].label) : statusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-3 lg:px-6">
          {pickup ? <Store className="hidden size-7 shrink-0 sm:block" style={{ color: PINK }} strokeWidth={1.5} /> : <Package className="hidden size-7 shrink-0 sm:block" style={{ color: PINK }} strokeWidth={1.5} />}
          <div><p className="text-[14px] text-[#374151]">Delivery Method</p><p className="text-[16px] font-semibold text-[#111827] sm:text-[17px]">{methodLabel}</p></div>
        </div>
      </div>

      {/* Progress */}
      {plainHistory ? (
        <Panel className="mt-6 p-5"><OrderTimeline status={status} events={events} /></Panel>
      ) : (
        <div className="mt-8">
          <ol className="hidden md:grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Order progress">
            {stages.map((s, i) => {
              const done = i < reached || (i === reached && i === stages.length - 1);
              const current = i === reached && !done;
              return (
                <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                  {i > 0 && <span aria-hidden className={cx("absolute right-1/2 top-[22px] h-[3px] w-full", i <= reached ? (i === reached && current ? "bg-[#E6007E]" : "bg-[#22A845]") : "bg-[#D1D5DB]")} />}
                  <span className={cx("relative z-10 grid size-11 place-items-center rounded-full",
                    done ? "bg-[#22A845] text-white" : current ? "bg-[#E6007E] text-white ring-[6px] ring-[#FCE7F3]" : "border-2 border-[#C4C8CF] bg-white text-[#9CA3AF]")}>
                    {current ? (s.label === "Out for Delivery" ? <Truck className="size-5" /> : <Clock className="size-5" />) : <Check className="size-5" strokeWidth={3} />}
                  </span>
                  <div className={cx("mt-3 rounded-2xl px-4 py-1.5", current && "bg-[#FDF2F8]")}>
                    <p className={cx("text-[16px] font-semibold", current ? "text-[#E6007E]" : "text-[#111827]")}>{s.label}</p>
                    <p className="text-[14px] text-[#4B5563]">{i <= reached && times[i] ? formatDateTime(times[i]!) : "Pending"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {/* Phone: the same steps, stacked */}
          <ol className="space-y-1 md:hidden" aria-label="Order progress">
            {stages.map((s, i) => {
              const done = i < reached || (i === reached && i === stages.length - 1);
              const current = i === reached && !done;
              return (
                <li key={s.label} className={cx("relative flex items-center gap-4 rounded-2xl px-3 py-2.5", current && "bg-[#FDF2F8]")}>
                  {i < stages.length - 1 && <span aria-hidden className={cx("absolute left-[29px] top-[46px] h-[calc(100%-26px)] w-[3px]", i < reached ? "bg-[#22A845]" : "bg-[#D1D5DB]")} />}
                  <span className={cx("relative z-10 grid size-9 shrink-0 place-items-center rounded-full",
                    done ? "bg-[#22A845] text-white" : current ? "bg-[#E6007E] text-white" : "border-2 border-[#C4C8CF] bg-white text-[#9CA3AF]")}>
                    {current ? (s.label === "Out for Delivery" ? <Truck className="size-4" /> : <Clock className="size-4" />) : <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <div>
                    <p className={cx("text-[15px] font-semibold", current ? "text-[#E6007E]" : "text-[#111827]")}>{s.label}</p>
                    <p className="text-[13px] text-[#4B5563]">{i <= reached && times[i] ? formatDateTime(times[i]!) : "Pending"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Where it is now: live text on the left, the fixed rider banner image on the right. */}
      <section className="relative mt-8 overflow-hidden rounded-3xl" style={{ background: BANNER_BG }} aria-live="polite">
        <div className="relative z-[1] flex p-6 sm:p-8 md:min-h-[260px] md:w-[52%] md:items-center lg:min-h-[300px] lg:p-10">
          <div className="flex gap-4">
            <CalendarDays className="mt-0.5 hidden size-8 shrink-0 sm:block" style={{ color: PINK }} strokeWidth={1.5} />
            <div>
              <p className="text-[18px] font-bold sm:text-[22px]" style={{ color: NAVY }}>{now.eyebrow ?? (pickup ? "Pickup Update" : "Delivery Update")}</p>
              <p className="mt-1 text-[32px] font-extrabold leading-tight sm:text-[44px]" style={{ color: PINK }}>{now.title}</p>
              {now.time && <p className="mt-2 flex items-center gap-2 text-[18px] font-bold sm:text-[22px]" style={{ color: NAVY }}><Clock className="size-6 shrink-0" style={{ color: PINK }} />{now.time}</p>}
              {now.line && <p className="mt-2 text-[16px] font-medium text-[#374151] sm:text-[18px]">{now.line}</p>}
            </div>
          </div>
        </div>
        {/* Desktop: the image fills the banner height on the right; its plain left side fades into the banner. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RIDER} alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-none md:block"
          style={{ maskImage: "linear-gradient(to right, transparent, #000 18%)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 18%)" }} />
        {/* Phone: the image under the text, cropped to the rider so he stays large. */}
        <div className="relative h-[210px] overflow-hidden md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RIDER} alt="" aria-hidden className="absolute bottom-0 right-[-40px] h-full w-auto max-w-none" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-6">

          <Panel className="p-5">
            <h2 className="text-[19px] font-bold" style={{ color: NAVY }}>Items in this Order ({items.reduce((n, i) => n + i.quantity, 0)})</h2>
            <ul className="mt-2 divide-y divide-[#EEF0F3]">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3">
                  <ProductImage category={i.variant?.product?.category?.slug ?? ""} name={i.product_name} size="sm"
                    image={i.variant?.image_url ?? i.variant?.product?.image_urls?.[0]} className="!w-[72px] shrink-0 rounded-xl sm:!w-[84px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-[#111827]">{i.product_name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {variantTags(i.variant).map((t) => <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[12px] text-[#374151]">{t}</span>)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[15px] font-medium text-[#111827]">Qty: {i.quantity}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="flex items-center gap-2.5 text-[19px] font-bold" style={{ color: NAVY }}><MapPin className="size-5" style={{ color: PINK }} /> {pickup ? "Pickup Details" : "Delivery Details"}</h2>
            <dl className="mt-2">
              {pickup
                ? <InfoRow divided label="Pickup at">{store.name}<br /><span className="font-normal text-[#4B5563]">{store.address}{store.landmark ? `, ${store.landmark}` : ""}</span></InfoRow>
                : address && <InfoRow divided label="Delivery Address">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{[address.city, address.county && address.county !== address.city ? address.county : null, "Kenya"].filter(Boolean).join(", ")}</InfoRow>}
              {order.customer_phone && <InfoRow divided label="Contact Phone">{order.customer_phone}</InfoRow>}
              <InfoRow divided label={pickup ? "Opening Hours" : "Delivery Method"}>{pickup ? store.hours : methodLabel}</InfoRow>
            </dl>
          </Panel>

          <section className="flex gap-4 rounded-3xl border border-[#F8D7E8] bg-[#FDF2F8] p-5">
            <Info className="size-7 shrink-0" style={{ color: PINK }} strokeWidth={1.75} />
            <div><p className="text-[18px] font-bold" style={{ color: PINK }}>What&apos;s next?</p><p className="mt-1 text-[15px] text-[#374151]">{now.next}</p></div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={`/order/${order.order_number}`} className="flex h-14 items-center justify-center gap-2.5 rounded-full border-2 bg-white text-[16px] font-semibold transition hover:bg-[#FDF2F8]" style={{ borderColor: PINK, color: PINK }}>
              <FileText className="size-5" strokeWidth={1.75} /> View Order Details
            </Link>
            <Link href="/contact" className="flex h-14 items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(230,0,126,0.7)] transition hover:opacity-90" style={{ background: PINK }}>
              <Headphones className="size-5" /> Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
