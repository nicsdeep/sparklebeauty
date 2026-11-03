import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft, Bell, CalendarDays, Check, CreditCard, Download, Headphones, Heart, LayoutGrid, LogOut, MapPin, Printer,
  Settings, ShoppingBag, Truck, X,
} from "lucide-react";
import { OrderTimeline, type OrderEvent } from "@/components/order-timeline";
import { CopyButton } from "@/components/copy-button";
import { ProductImage } from "@/components/shop/product-image";
import { SubmitButton } from "@/components/submit-button";
import { cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/store";
import { vatHeading } from "@/lib/invoices";
import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META, STATUS_META, type OrderStatus, type PaymentMethod } from "@/lib/format";
import { signOut } from "@/app/login/actions";

// Customer order details (Nicholas's design, 2026-11-03).

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

const PINK = "#E6007E";
const NAVY = "#0F1738";

type Item = {
  id: string; product_name: string; sku: string | null; quantity: number; unit_price: number; line_total: number; tax_rate: number;
  variant: { color: string | null; shade: string | null; size: string | null; hair_length: string | null; image_url: string | null;
    product: { image_urls: string[] | null; category: { slug: string } | null } | null } | null;
};

/** The four stages customers follow; the admin keeps the full ORDER_FLOW. */
function stages(pickup: boolean) {
  return [
    { label: "Order Confirmed", text: "We've received your order.", statuses: ["pending", "confirmed", "paid"] },
    { label: "Processing", text: "We're preparing your order.", statuses: ["processing", "packed"] },
    pickup
      ? { label: "Ready for Pickup", text: "Your order is waiting at the shop.", statuses: ["dispatched"] }
      : { label: "Out for Delivery", text: "Your order is on the way.", statuses: ["dispatched"] },
    { label: pickup ? "Collected" : "Delivered", text: "Order completed.", statuses: ["delivered", "completed"] },
  ] as { label: string; text: string; statuses: OrderStatus[] }[];
}

function Timeline({ status, events, pickup }: { status: OrderStatus; events: OrderEvent[]; pickup: boolean }) {
  const list = stages(pickup);
  const reached = list.findIndex((s) => s.statuses.includes(status));
  return (
    <ol>
      {list.map((s, i) => {
        const done = i <= reached;
        const when = events.find((e) => s.statuses.includes(e.status))?.created_at;
        return (
          <li key={s.label} className={cx("relative flex gap-4 rounded-xl px-3 py-2.5", i === reached && "bg-[#E8F7EC]")}>
            {i < list.length - 1 && <span aria-hidden className={cx("absolute left-[22px] top-9 h-[calc(100%-18px)] w-0.5", i < reached ? "bg-[#22A845]" : "bg-[#D1D5DB]")} />}
            <span className={cx("relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
              done ? "bg-[#22A845] text-white" : "border-2 border-[#C4C8CF] bg-white")}>
              {done && <Check className="size-3" strokeWidth={3.5} />}
            </span>
            <div>
              <p className={cx("text-[15px] font-semibold", done ? "text-[#111827]" : "text-[#374151]")}>{i === 0 && status === "pending" ? "Order Placed" : s.label}</p>
              <p className="text-[13px] text-[#6B7280]">{done && when ? formatDateTimeFull(when) : i === 0 && status === "pending" ? "Waiting for payment." : s.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("rounded-3xl border border-[#EEE6EC] bg-white shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)]", className)}>{children}</section>;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-3 py-1.5 text-[14px]">
      <dt className="text-[#4B5563]">{label}</dt><dd className="font-medium text-[#111827]">{children}</dd>
    </div>
  );
}

const ACCOUNT_LINKS = [
  { href: "/account", label: "Dashboard", Icon: LayoutGrid },
  { href: "/account#orders", label: "My Orders", Icon: ShoppingBag, active: true },
  { href: "/account#addresses", label: "My Address", Icon: MapPin },
  { href: "/account#wishlist", label: "Wishlist", Icon: Heart },
  { href: "/account#notifications", label: "Notifications", Icon: Bell },
  { href: "/account#settings", label: "Account Settings", Icon: Settings },
];

export default async function OrderPage({ params }: Params) {
  const { number } = await params;
  const profile = await requireUser(`/order/${number}`);
  const store = await getStoreSettings();
  const supabase = await createClient();
  // RLS limits this to the customer's own orders (or staff).
  const { data: order } = await supabase.from("orders")
    .select(`*, order_items(id, product_name, sku, quantity, unit_price, line_total, tax_rate,
      variant:product_variants(color, shade, size, hair_length, image_url, product:products(image_urls, category:categories(slug)))),
      payments(method, status, amount, provider_reference, paid_at, created_at), order_events(status, note, created_at), invoices(id, kind)`)
    .eq("order_number", number).maybeSingle();
  if (!order) notFound();

  const events = ([...order.order_events] as OrderEvent[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const items = order.order_items as unknown as Item[];
  const payments = (order.payments as { method: PaymentMethod; status: string; amount: number; provider_reference: string | null; paid_at: string | null; created_at: string }[])
    .filter((p) => p.status !== "failed").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const address = order.shipping_address as { address_line1?: string; address_line2?: string; city?: string; county?: string } | null;
  const pickup = order.delivery_method === "pickup";
  const paid = ["paid", "refunded", "partially_refunded"].includes(order.payment_status);
  // A paid order the shop hasn't moved on yet is confirmed as far as the customer is concerned.
  const status = (order.status === "pending" && paid ? "confirmed" : order.status) as OrderStatus;
  const hasInvoice = (order.invoices as { kind: string }[]).some((i) => i.kind === "invoice");
  // Till sales start out completed, and cancelled orders don't follow the stages: list what happened instead.
  const plainHistory = status === "cancelled" || events[0]?.status === "completed";
  const paidAt = payments.find((p) => p.paid_at)?.paid_at;
  const statusTone = status === "cancelled" ? "bg-[#FDECEC] text-[#B91C1C]" : status === "pending" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#DCF5E3] text-[#15803D]";
  const statusLabel = status === "pending" ? "Awaiting payment" : STATUS_META[status]?.label ?? status;
  const variantTags = (v: Item["variant"]) => v ? [
    v.color && `Color: ${v.color}`, v.shade && `Shade: ${v.shade}`, v.hair_length && `Length: ${v.hair_length}`, v.size && `Size: ${v.size}`,
  ].filter(Boolean) as string[] : [];

  return (
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[230px_1fr]">
      {/* Account menu (desktop) */}
      <aside className="hidden h-fit rounded-3xl border border-[#F1E8EE] bg-white p-4 lg:sticky lg:top-36 lg:block">
        <div className="flex items-center gap-3 border-b border-[#F1E8EE] px-2 pb-4">
          <span className="grid size-12 place-items-center rounded-full bg-[#FDF2F8] text-lg font-bold" style={{ color: PINK }}>{(profile.full_name ?? "?").charAt(0).toUpperCase()}</span>
          <div><p className="font-bold text-[#111827]">Hello, {profile.full_name?.split(" ")[0] ?? "there"}</p><p className="text-sm text-[#6B7280]">My Account</p></div>
        </div>
        <nav className="mt-3 space-y-1">
          {ACCOUNT_LINKS.map(({ href, label, Icon, active }) => (
            <Link key={href} href={href} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition", active ? "bg-[#FDF2F8] font-semibold" : "text-[#111827] hover:bg-[#F9FAFB]")}
              style={active ? { color: PINK } : undefined}>
              <Icon className="size-5" strokeWidth={1.75} />{label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-3 border-t border-[#F1E8EE] pt-3">
          <SubmitButton unstyled className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[#111827] hover:bg-[#F9FAFB]"><LogOut className="size-5" strokeWidth={1.75} />Log Out</SubmitButton>
        </form>
      </aside>

      <div className="min-w-0">
        <Link href="/account#orders" className="inline-flex items-center gap-2 text-[15px] font-medium text-[#111827] hover:underline"><ArrowLeft className="size-5" /> Back to Orders</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[36px]" style={{ color: NAVY }}>Order Details</h1>
            <p className="mt-1 text-[16px] text-[#4B5563]">Here are the full details of your order.</p>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {hasInvoice && (
              <Link href={`/order/${order.order_number}/invoice`} className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] bg-white px-5 text-[15px] font-semibold transition hover:bg-[#FDF2F8]" style={{ borderColor: PINK, color: PINK }}>
                <Download className="size-[18px]" /> Download Invoice
              </Link>
            )}
            {paid && (
              <Link href={`/order/${order.order_number}/receipt`} className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] bg-white px-5 text-[15px] font-semibold transition hover:bg-[#FDF2F8]" style={{ borderColor: PINK, color: PINK }}>
                <Printer className="size-[18px]" /> Print Receipt
              </Link>
            )}
            <a href="#tracking" className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(230,0,126,0.7)] transition hover:opacity-90" style={{ background: PINK }}>
              <Truck className="size-[18px]" /> Track Order
            </a>
          </div>
        </div>

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
            <p className="text-[14px] text-[#374151]">Order Status</p>
            <span className={cx("mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[15px] font-semibold", statusTone)}>
              <span className={cx("grid size-5 place-items-center rounded-full text-white", status === "cancelled" ? "bg-[#DC2626]" : status === "pending" ? "bg-[#D97706]" : "bg-[#22A845]")}>
                {status === "cancelled" ? <X className="size-3" strokeWidth={3.5} /> : <Check className="size-3" strokeWidth={3.5} />}
              </span>
              {statusLabel}
            </span>
          </div>
          <div className="lg:px-6">
            <p className="text-[14px] text-[#374151]">{paid ? "Total Paid" : "Total"}</p>
            <p className="text-[22px] font-extrabold tabular-nums sm:text-[26px]" style={{ color: PINK }}>{kes(order.total_amount)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
          <div className="min-w-0 space-y-6">
            {/* Items */}
            <Panel className="p-4 sm:p-5">
              <h2 className="px-1 text-[20px] font-bold" style={{ color: NAVY }}>Items Ordered ({items.reduce((n, i) => n + i.quantity, 0)})</h2>
              <div className="mt-4 hidden grid-cols-[1fr_110px_60px_120px] rounded-xl bg-[#F7F7F9] px-4 py-2.5 text-[14px] font-semibold text-[#111827] sm:grid">
                <span>Item</span><span className="text-right">Price</span><span className="text-center">Qty</span><span className="text-right">Total</span>
              </div>
              <ul className="divide-y divide-[#EEF0F3]">
                {items.map((i) => (
                  <li key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-1 py-4 sm:grid-cols-[1fr_110px_60px_120px] sm:px-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <ProductImage category={i.variant?.product?.category?.slug ?? ""} name={i.product_name} size="sm"
                        image={i.variant?.image_url ?? i.variant?.product?.image_urls?.[0]} className="!w-[72px] shrink-0 rounded-xl sm:!w-[84px]" />
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium leading-snug text-[#111827]">{i.product_name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {variantTags(i.variant).map((t) => <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[12px] text-[#374151]">{t}</span>)}
                        </div>
                        <p className="mt-1 text-[13px] text-[#6B7280] sm:hidden">{i.quantity} × {kes(i.unit_price)}</p>
                      </div>
                    </div>
                    <span className="hidden text-right text-[15px] font-medium tabular-nums text-[#111827] sm:block">{kes(i.unit_price)}</span>
                    <span className="hidden text-center text-[15px] font-medium text-[#111827] sm:block">{i.quantity}</span>
                    <span className="text-right text-[15px] font-semibold tabular-nums text-[#111827]">{kes(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-2 border-t border-[#EEF0F3] px-1 pt-4 text-[16px] sm:px-4">
                <div className="flex justify-between"><dt className="text-[#111827]">Subtotal</dt><dd className="tabular-nums text-[#111827]">{kes(order.subtotal)}</dd></div>
                {Number(order.discount_amount) > 0 && <div className="flex justify-between"><dt className="text-[#111827]">Discount</dt><dd className="tabular-nums text-[#15803D]">– {kes(order.discount_amount)}</dd></div>}
                {Number(order.tax_amount) > 0 && <div className="flex justify-between"><dt className="text-[#111827]">{vatHeading(items.map((i) => Number(i.tax_rate)))}</dt><dd className="tabular-nums text-[#111827]">{kes(order.tax_amount)}</dd></div>}
                {!pickup && <div className="flex justify-between"><dt className="text-[#111827]">Delivery Fee</dt><dd className="tabular-nums text-[#111827]">{Number(order.delivery_amount) ? kes(order.delivery_amount) : "Free"}</dd></div>}
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#FCE7F3] to-[#FDF2F8] px-4 py-3.5 sm:px-5">
                <span className="text-[20px] font-bold sm:text-[22px]" style={{ color: PINK }}>{paid ? "Total Paid" : "Total"}</span>
                <span className="text-[22px] font-extrabold tabular-nums sm:text-[24px]" style={{ color: NAVY }}>{kes(order.total_amount)}</span>
              </div>
            </Panel>

            <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FDF2F8]"><Headphones className="size-5" style={{ color: PINK }} /></span>
                <div><p className="text-[17px] font-bold" style={{ color: NAVY }}>Need Help?</p><p className="text-[14px] text-[#4B5563]">Contact our support team for any questions about your order.</p></div>
              </div>
              <Link href="/contact" className="inline-flex h-11 items-center rounded-full border-[1.5px] px-6 text-[15px] font-semibold transition hover:bg-[#FDF2F8]" style={{ borderColor: PINK, color: PINK }}>Contact Support</Link>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel id="tracking" className="scroll-mt-36 p-5">
              <h2 className="flex items-center gap-2 text-[18px] font-bold" style={{ color: NAVY }}><Truck className="size-5" strokeWidth={1.75} /> Order Timeline</h2>
              <div className="mt-3">{plainHistory ? <OrderTimeline status={status} events={events} /> : <Timeline status={status} events={events} pickup={pickup} />}</div>
            </Panel>

            <Panel className="p-5">
              <h2 className="flex items-center gap-2.5 text-[18px] font-bold" style={{ color: NAVY }}><CreditCard className="size-5" style={{ color: PINK }} /> Payment Information</h2>
              <dl className="mt-3">
                <InfoRow label="Payment Method">{payments.length > 1 ? payments.map((p) => `${PAYMENT_LABEL[p.method]} ${kes(p.amount)}`).join(" + ") : payments[0] ? PAYMENT_LABEL[payments[0].method] : "-"}</InfoRow>
                <InfoRow label="Payment Status">
                  <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold", paid ? "bg-[#DCF5E3] text-[#15803D]" : "bg-[#FEF3C7] text-[#92400E]")}>
                    {paid && <span className="grid size-4 place-items-center rounded-full bg-[#22A845]"><Check className="size-2.5 text-white" strokeWidth={4} /></span>}
                    {PAYMENT_STATUS_META[order.payment_status]?.label ?? order.payment_status}
                  </span>
                </InfoRow>
                {payments.filter((p) => p.provider_reference).map((p, i) => (
                  <InfoRow key={i} label={payments.length > 1 ? `${PAYMENT_LABEL[p.method]} reference` : "Reference"}>
                    <span className="inline-flex items-center gap-1.5 font-semibold">{p.provider_reference}<CopyButton text={p.provider_reference!} label="Copy payment reference" /></span>
                  </InfoRow>
                ))}
                {paidAt && <InfoRow label="Payment Date">{formatDateTimeFull(paidAt)}</InfoRow>}
              </dl>
            </Panel>

            <Panel className="p-5">
              <h2 className="flex items-center gap-2.5 text-[18px] font-bold" style={{ color: NAVY }}><MapPin className="size-5" style={{ color: PINK }} /> {pickup ? "Pickup Information" : "Delivery Information"}</h2>
              <dl className="mt-3">
                {pickup
                  ? <InfoRow label="Pickup at">{store.name}<br /><span className="font-normal text-[#4B5563]">{store.address}{store.landmark ? `, ${store.landmark}` : ""}</span></InfoRow>
                  : address && <InfoRow label="Delivery Address">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{[address.city, address.county && address.county !== address.city ? address.county : null, "Kenya"].filter(Boolean).join(", ")}</InfoRow>}
                {order.customer_phone && <InfoRow label="Contact Phone">{order.customer_phone}</InfoRow>}
                <InfoRow label={pickup ? "Opening Hours" : "Delivery Method"}>{pickup ? store.hours : "Standard Delivery"}</InfoRow>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
