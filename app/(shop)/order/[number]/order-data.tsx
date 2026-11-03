import { notFound } from "next/navigation";
import type { OrderEvent } from "@/components/order-timeline";
import { cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { STATUS_META, type OrderStatus, type PaymentMethod } from "@/lib/format";

// Shared by the customer order pages: details (/order/<n>) and tracking (/order/<n>/track).

export const PINK = "#E6007E";
export const NAVY = "#0F1738";

export type OrderItem = {
  id: string; product_name: string; sku: string | null; quantity: number; unit_price: number; line_total: number; tax_rate: number;
  variant: { color: string | null; shade: string | null; size: string | null; hair_length: string | null; image_url: string | null;
    product: { image_urls: string[] | null; category: { slug: string } | null } | null } | null;
};

/** The order with its items, payments, events and invoices. RLS limits it to the customer's own orders (or staff). */
export async function loadCustomerOrder(number: string) {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders")
    .select(`*, order_items(id, product_name, sku, quantity, unit_price, line_total, tax_rate,
      variant:product_variants(color, shade, size, hair_length, image_url, product:products(image_urls, category:categories(slug)))),
      payments(method, status, amount, provider_reference, paid_at, created_at), order_events(status, note, created_at), invoices(id, kind)`)
    .eq("order_number", number).maybeSingle();
  if (!order) notFound();

  const events = ([...order.order_events] as OrderEvent[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const payments = (order.payments as { method: PaymentMethod; status: string; amount: number; provider_reference: string | null; paid_at: string | null; created_at: string }[])
    .filter((p) => p.status !== "failed").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const paid = ["paid", "refunded", "partially_refunded"].includes(order.payment_status);
  return {
    order,
    items: order.order_items as unknown as OrderItem[],
    events,
    payments,
    paid,
    pickup: order.delivery_method === "pickup",
    // A paid order the shop hasn't moved on yet is confirmed as far as the customer is concerned.
    status: (order.status === "pending" && paid ? "confirmed" : order.status) as OrderStatus,
    address: order.shipping_address as { address_line1?: string; address_line2?: string; city?: string; county?: string } | null,
    hasInvoice: (order.invoices as { kind: string }[]).some((i) => i.kind === "invoice"),
    // Till sales start out completed, and cancelled orders don't follow the stages: list what happened instead.
    plainHistory: order.status === "cancelled" || events[0]?.status === "completed",
  };
}

export type Stage = { label: string; text: string; statuses: OrderStatus[] };

/**
 * The stages customers follow (the admin keeps the full ORDER_FLOW). Packed ("ready for
 * dispatch") is an internal step: for delivery orders the customer still sees Processing until
 * the rider leaves.
 */
export function customerStages(pickup: boolean): Stage[] {
  return pickup ? [
    { label: "Confirmed", text: "We've received your order.", statuses: ["pending", "confirmed", "paid"] },
    { label: "Processing", text: "We're preparing your order.", statuses: ["processing"] },
    { label: "Ready for Pickup", text: "Your order is waiting at the shop.", statuses: ["packed", "dispatched"] },
    { label: "Collected", text: "Order completed.", statuses: ["delivered", "completed"] },
  ] : [
    { label: "Confirmed", text: "We've received your order.", statuses: ["pending", "confirmed", "paid"] },
    { label: "Processing", text: "We're preparing your order.", statuses: ["processing", "packed"] },
    { label: "Out for Delivery", text: "Your order is on the way.", statuses: ["dispatched"] },
    { label: "Delivered", text: "Order completed.", statuses: ["delivered", "completed"] },
  ];
}

/** When each stage was reached (the first event of any of its statuses; the order date for the first). */
export function stageTimes(stages: Stage[], events: OrderEvent[], createdAt: string) {
  return stages.map((s, i) => events.find((e) => s.statuses.includes(e.status))?.created_at ?? (i === 0 ? createdAt : undefined));
}

export function statusLabel(status: OrderStatus) {
  return status === "pending" ? "Awaiting payment" : STATUS_META[status]?.label ?? status;
}

export function statusTone(status: OrderStatus) {
  return status === "cancelled" ? "bg-[#FDECEC] text-[#B91C1C]" : status === "pending" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#DCF5E3] text-[#15803D]";
}

export function variantTags(v: OrderItem["variant"]) {
  return v ? [v.color && `Color: ${v.color}`, v.shade && `Shade: ${v.shade}`, v.hair_length && `Length: ${v.hair_length}`, v.size && `Size: ${v.size}`]
    .filter(Boolean) as string[] : [];
}

export function Panel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("rounded-3xl border border-[#EEE6EC] bg-white shadow-[0_6px_24px_-16px_rgba(15,23,56,0.18)]", className)}>{children}</section>;
}

export function InfoRow({ label, children, divided }: { label: string; children: React.ReactNode; divided?: boolean }) {
  return (
    <div className={cx("grid grid-cols-[minmax(0,9.5rem)_1fr] gap-3 text-[14px]", divided ? "border-b border-[#EEF0F3] py-3 last:border-0" : "py-1.5")}>
      <dt className="text-[#4B5563]">{label}</dt><dd className="font-medium text-[#111827]">{children}</dd>
    </div>
  );
}
