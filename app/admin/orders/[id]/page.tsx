import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Badge, Card, CardHeader, PaymentBadge, StatusBadge, buttonClass } from "@/components/ui";
import { OrderTimeline, type OrderEvent } from "@/components/order-timeline";
import { OrderActions } from "./order-actions";
import { createClient } from "@/lib/supabase/server";
import { STORE } from "@/lib/store";
import { formatDateTime, kes, PAYMENT_LABEL, whatsappLink, type OrderStatus, type PaymentMethod } from "@/lib/format";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders")
    .select("*, tier:pricing_tiers(name, code), order_items(*), payments(method, status, amount, provider_reference, paid_at), order_events(status, note, created_at, by:profiles(full_name))")
    .eq("id", id).maybeSingle();
  if (!order) notFound();

  const variantIds = order.order_items.map((i: { variant_id: string }) => i.variant_id).filter(Boolean);
  const { data: levels } = await supabase.from("inventory_levels").select("variant_id, quantity, reserved").in("variant_id", variantIds);
  const stockBy = new Map((levels ?? []).map((l) => [l.variant_id, l]));
  const events = ([...order.order_events] as (OrderEvent & { by: { full_name: string } | null })[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const payment = order.payments[0] as { method: PaymentMethod; status: string; amount: number; provider_reference: string | null; paid_at: string | null } | undefined;
  const address = order.shipping_address as { address_line1?: string; address_line2?: string; city?: string; county?: string } | null;
  const status = order.status as OrderStatus;
  const reserved = ["pending", "confirmed", "paid", "processing", "packed"].includes(status);
  const wa = whatsappLink(order.customer_phone, `Hi ${order.customer_name?.split(" ")[0]}, this is Sparkle Beauty about your order ${order.order_number}.`);

  return (
    <div>
      <Link href="/admin/orders" className="text-sm font-semibold text-brand-700">← Orders</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
        <StatusBadge status={status} />
        <Badge tone={order.channel === "pos" ? "neutral" : "brand"}>{order.channel === "pos" ? "POS" : "Online"}</Badge>
        {order.tier?.code === "wholesale" && <Badge tone="info">Wholesale</Badge>}
        <span className="text-ink-muted">{formatDateTime(order.created_at)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" action={order.customer_id && <Link href={`/admin/customers/${order.customer_id}`} className="text-sm font-semibold text-brand-700">Open CRM profile</Link>} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-lg font-semibold">{order.customer_name}</p>
                {order.customer_phone && <p className="text-lg">{order.customer_phone}</p>}
                {order.customer_email && <p className="text-ink-muted">{order.customer_email}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.customer_phone && <a href={`tel:${order.customer_phone.replace(/\s/g, "")}`} className={buttonClass({ variant: "secondary", size: "sm" })}><Phone className="size-4" /> Call</a>}
                  {wa && <a href={wa} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary", size: "sm" })}><MessageCircle className="size-4" /> WhatsApp</a>}
                  {order.customer_email && <a href={`mailto:${order.customer_email}?subject=Your Sparkle order ${order.order_number}`} className={buttonClass({ variant: "secondary", size: "sm" })}><Mail className="size-4" /> Email</a>}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-muted">{order.delivery_method === "pickup" ? "Store pickup" : "Deliver to"}</p>
                {order.delivery_method === "pickup" ? <p>Shop, {STORE.address}</p> : address && (
                  <p className="text-[15px]">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{address.city}{address.county && address.county !== address.city ? `, ${address.county}` : ""}</p>
                )}
                {order.notes && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm">“{order.notes}”</p>}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Items" subtitle={reserved ? "Stock is reserved for this order and is deducted when it's dispatched." : status === "cancelled" ? "Reserved stock was released." : "Stock has been deducted."} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">Product</th><th className="px-3 py-2.5 font-medium">Qty</th><th className="px-3 py-2.5 font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">In stock now</th><th className="px-5 py-2.5 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {order.order_items.map((i: { id: string; variant_id: string; product_name: string; sku: string; quantity: number; unit_price: number; line_total: number }) => {
                    const l = stockBy.get(i.variant_id);
                    return (
                      <tr key={i.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">{i.product_name}<span className="block text-xs text-ink-muted">{i.sku}</span></td>
                        <td className="px-3 py-3">{i.quantity}</td>
                        <td className="px-3 py-3">{kes(i.unit_price)}</td>
                        <td className="px-3 py-3 text-sm">{l ? <>{l.quantity - l.reserved} available<span className="block text-ink-muted">{l.quantity} on hand · {l.reserved} reserved</span></> : "-"}</td>
                        <td className="px-5 py-3 text-right font-semibold">{kes(i.line_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1 border-t border-line px-5 py-4 text-[15px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{kes(order.subtotal)}</dd></div>
              {Number(order.discount_amount) > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount</dt><dd>-{kes(order.discount_amount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{Number(order.delivery_amount) ? kes(order.delivery_amount) : "Free"}</dd></div>
              <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd>{kes(order.total_amount)}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next step" />
            <div className="p-5">
              <OrderActions orderId={order.id} status={status} canCancel={reserved} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment" />
            <div className="space-y-1.5 p-5 text-[15px]">
              <div className="flex items-center justify-between"><span className="font-semibold">{payment ? PAYMENT_LABEL[payment.method] : "-"}</span><PaymentBadge status={order.payment_status} /></div>
              <p>{kes(payment?.amount ?? order.total_amount)}</p>
              {payment?.provider_reference && <p className="text-ink-muted">Ref <span className="font-mono font-semibold text-ink">{payment.provider_reference}</span></p>}
              {payment?.paid_at && <p className="text-sm text-ink-muted">Paid {formatDateTime(payment.paid_at)}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <div className="p-5"><OrderTimeline status={status} events={events} channel={order.channel} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
