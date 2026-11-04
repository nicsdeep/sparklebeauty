import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Printer, ReceiptText } from "lucide-react";
import { BackLink } from "@/components/admin/back-link";
import { Badge, Card, CardHeader, PaymentBadge, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { channelMeta, formatDateTimeFull, kes, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import { vatHeading } from "@/lib/invoices";
import { ruleLabel, type PriceRule } from "@/lib/pricing";

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Sale ${decodeURIComponent((await params).number)}` };
}

/** One till sale: who, when, what, how it was paid, and its receipt and tax invoice. */
export default async function SalePage({ params }: Params) {
  const number = decodeURIComponent((await params).number);
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders")
    .select(`id, order_number, created_at, channel, customer_id, customer_name, customer_phone, subtotal, discount_amount, tax_amount, total_amount, payment_status, status,
      cashier:profiles!orders_created_by_fkey(full_name),
      order_items(id, product_name, sku, quantity, unit_price, line_total, discount_amount, tax_amount, tax_rate, price_rule),
      payments(method, status, amount, provider_reference, paid_at, created_at), invoices(id, kind, invoice_number)`)
    .eq("order_number", number).maybeSingle();
  if (!o) notFound();

  const items = o.order_items as { id: string; product_name: string; sku: string | null; quantity: number; unit_price: number; line_total: number; discount_amount: number; tax_amount: number; tax_rate: number; price_rule: PriceRule | null }[];
  const payments = (o.payments as { method: PaymentMethod; status: string; amount: number; provider_reference: string | null; paid_at: string | null; created_at: string }[])
    .filter((p) => p.status !== "failed").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const invoice = (o.invoices as { id: string; kind: string; invoice_number: string }[]).find((i) => i.kind === "invoice");
  const cashier = (o.cashier as unknown as { full_name: string | null } | null)?.full_name;
  const units = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink fallback="/admin/pos/sales" label="Recent Sales" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Sale {o.order_number}</h1>
            <PaymentBadge status={o.payment_status} />
            <Badge tone={channelMeta(o.channel).tone}>{channelMeta(o.channel).label}</Badge>
          </div>
          <p className="text-ink-muted">{formatDateTimeFull(o.created_at)}{cashier ? ` · Cashier ${cashier}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/orders/${o.id}/receipt`} className={buttonClass({ variant: "secondary" })}><Printer className="size-4" /> Print Receipt</Link>
          {invoice && <Link href={`/admin/invoices/${invoice.id}`} className={buttonClass({ variant: "secondary" })}><FileText className="size-4" /> View Invoice</Link>}
          <Link href={`/admin/orders/${o.id}`} className={buttonClass({ variant: "ghost" })}><ReceiptText className="size-4" /> Order record</Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title={`Items (${units})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="text-sm text-ink-muted"><tr className="border-b border-line">
                <th className="px-5 py-2.5 font-medium">Product</th><th className="px-3 py-2.5 font-medium">Qty</th>
                <th className="px-3 py-2.5 text-right font-medium">Price</th><th className="px-5 py-2.5 text-right font-medium">Total</th></tr></thead>
              <tbody>
                {items.map((i) => {
                  const rule = i.price_rule ? ruleLabel(i.price_rule) : null;
                  return (
                    <tr key={i.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">{i.product_name}<span className="block text-xs text-ink-muted">{i.sku}{rule ? ` · ${rule}` : ""}</span></td>
                      <td className="px-3 py-3">{i.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{kes(i.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{kes(i.line_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[15px]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{kes(o.subtotal)}</dd></div>
            {Number(o.discount_amount) > 0 && <div className="flex justify-between text-mint-fg"><dt>Discount</dt><dd className="tabular-nums">-{kes(o.discount_amount)}</dd></div>}
            {Number(o.tax_amount) > 0 && <div className="flex justify-between"><dt>{vatHeading(items.map((i) => Number(i.tax_rate)))}</dt><dd className="tabular-nums">{kes(o.tax_amount)}</dd></div>}
            <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{kes(o.total_amount)}</dd></div>
          </dl>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <div className="p-5 text-[15px]">
              <p className="font-semibold">{o.customer_name ?? "Walk-in customer"}</p>
              {o.customer_phone && <p className="text-ink-muted">{o.customer_phone}</p>}
              {o.customer_id && <Link href={`/admin/customers/${o.customer_id}`} className="mt-2 inline-block text-sm font-semibold text-brand-700">Customer profile ›</Link>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment" />
            <ul className="divide-y divide-line">
              {payments.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3 text-[15px]">
                  <span><span className="font-semibold">{PAYMENT_LABEL[p.method] ?? p.method}</span>
                    {p.provider_reference && <span className="block font-mono text-sm text-ink-muted">{p.provider_reference}</span>}</span>
                  <span className="text-right"><span className="block font-semibold tabular-nums">{kes(p.amount)}</span><PaymentBadge status={p.status} /></span>
                </li>
              ))}
              {!payments.length && <li className="px-5 py-3 text-ink-muted">No payment recorded.</li>}
            </ul>
            {invoice && <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">Tax invoice <Link href={`/admin/invoices/${invoice.id}`} className="font-semibold text-brand-700">{invoice.invoice_number}</Link></p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
