import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrderTimeline, type OrderEvent } from "@/components/order-timeline";
import { Card, CardHeader, PaymentBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STORE } from "@/lib/store";
import { formatDateTime, kes, PAYMENT_LABEL, type OrderStatus, type PaymentMethod } from "@/lib/format";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

export default async function OrderPage({ params }: Params) {
  const { number } = await params;
  await requireUser(`/order/${number}`);
  const supabase = await createClient();
  // RLS limits this to the customer's own orders (or staff).
  const { data: order } = await supabase.from("orders")
    .select("*, order_items(*), payments(method, status, amount, provider_reference, paid_at), order_events(status, note, created_at)")
    .eq("order_number", number).maybeSingle();
  if (!order) notFound();

  const events = ([...order.order_events] as OrderEvent[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const payment = order.payments[0] as { method: PaymentMethod; status: string; provider_reference: string | null } | undefined;
  const address = order.shipping_address as { address_line1?: string; address_line2?: string; city?: string } | null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/account#orders" className="text-sm font-semibold text-brand-700">← Back to my orders</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Order {order.order_number}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-ink-muted">Placed {formatDateTime(order.created_at)} · {order.channel === "pos" ? "In store" : "Online"}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Order tracking" />
          <div className="p-5"><OrderTimeline status={order.status as OrderStatus} events={events} channel={order.channel} /></div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment" />
            <div className="space-y-2 p-5 text-[15px]">
              <div className="flex justify-between"><span>{payment ? PAYMENT_LABEL[payment.method] : "-"}</span><PaymentBadge status={order.payment_status} /></div>
              {payment?.provider_reference && <p className="text-ink-muted">Ref <span className="font-mono font-semibold text-ink">{payment.provider_reference}</span></p>}
            </div>
          </Card>
          <Card>
            <CardHeader title={order.delivery_method === "pickup" ? "Store pickup" : "Delivery"} />
            <div className="p-5 text-[15px]">
              <p className="font-semibold">{order.customer_name}</p>
              <p className="text-ink-muted">{order.customer_phone}</p>
              {order.delivery_method === "pickup"
                ? <p className="mt-2">{STORE.name}, {STORE.address}<br /><span className="text-ink-muted">{STORE.landmark} · {STORE.hours}</span></p>
                : address && <p className="mt-2">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{address.city}</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Items" />
        <ul className="divide-y divide-line">
          {order.order_items.map((i: { id: string; product_name: string; quantity: number; unit_price: number; line_total: number }) => (
            <li key={i.id} className="flex justify-between gap-4 px-5 py-3">
              <span>{i.quantity} × {i.product_name}</span><span className="font-semibold">{kes(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[15px]">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{kes(order.subtotal)}</dd></div>
          {Number(order.discount_amount) > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount</dt><dd>-{kes(order.discount_amount)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{Number(order.delivery_amount) ? kes(order.delivery_amount) : "Free"}</dd></div>
          <div className="flex justify-between pt-2 text-lg font-bold"><dt>Total</dt><dd>{kes(order.total_amount)}</dd></div>
        </dl>
      </Card>
    </div>
  );
}
