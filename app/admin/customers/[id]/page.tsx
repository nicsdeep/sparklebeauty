import Link from "next/link";
import { notFound } from "next/navigation";
import { Cake, Mail, MessageCircle, Phone, Tag, PackageCheck } from "lucide-react";
import { AiCard, Badge, Card, CardHeader, StatusBadge, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, kes, whatsappLink } from "@/lib/format";
import { loadSales } from "@/lib/sales-data";
import { customerSentence } from "@/lib/insights";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, { data: orders }, { data: addresses }, { data: notes }, { data: loyalty }, { data: biz }, sales] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("orders").select("id, order_number, status, channel, total_amount, created_at, order_items(product_name, quantity, line_total)")
      .eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("customer_addresses").select("*").eq("user_id", id).order("is_default", { ascending: false }),
    supabase.from("customer_notes").select("id, note, created_at, by:profiles!customer_notes_created_by_fkey(full_name)").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("loyalty_transactions").select("id, points, reason, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("wholesale_accounts").select("business_name, business_location").eq("profile_id", id).maybeSingle(),
    loadSales(180),
  ]);
  if (!c) notFound();

  const valid = (orders ?? []).filter((o) => o.status !== "cancelled");
  const spend = valid.reduce((s, o) => s + Number(o.total_amount), 0);
  const products = new Map<string, number>();
  for (const o of valid) for (const i of o.order_items) products.set(i.product_name.split(" – ")[0], (products.get(i.product_name.split(" – ")[0]) ?? 0) + i.quantity);
  const preferred = [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const address = addresses?.[0];
  const first = c.full_name?.split(" ")[0] ?? "there";
  const insight = customerSentence(sales, id);
  const topProduct = preferred[0]?.[0];

  const wa = (text: string) => whatsappLink(c.phone, text);
  const templates = [
    { Icon: Tag, label: "Send offer", text: `Hi ${first}! As a valued Sparkle customer, enjoy 10% off your next order with code SPARKLE10. Shop at Sparkle Beauty & Cosmetics.` },
    { Icon: PackageCheck, label: "Restock alert", text: `Hi ${first}! Good news: ${topProduct ?? "your favourite products"} ${topProduct ? "is" : "are"} back in stock at Sparkle. Reply to reserve yours.` },
    { Icon: Cake, label: "Birthday promotion", text: `Happy birthday ${first}! Enjoy a birthday treat from Sparkle: 15% off anything this week.` },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-sm font-semibold text-brand-700">← Customers</Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">{c.full_name}</h1>
              {biz ? <Badge tone="info">Wholesale · {biz.business_name}</Badge> : <Badge tone="brand">Retail customer</Badge>}
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-lg sm:grid-cols-2">
              <a href={`tel:${c.phone?.replace(/\s/g, "")}`} className="flex items-center gap-2 font-semibold"><Phone className="size-5 text-brand-600" />{c.phone}</a>
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 font-semibold"><Mail className="size-5 text-brand-600" />{c.email}</a>
            </div>
            {address && <p className="mt-2 text-ink-muted">{address.address_line1}, {address.city}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${c.phone?.replace(/\s/g, "")}`} className={buttonClass({ size: "md" })}><Phone className="size-4" /> Call</a>
            {wa("") && <a href={wa(`Hi ${first}, this is Sparkle Beauty & Cosmetics.`)!} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary" })}><MessageCircle className="size-4" /> WhatsApp</a>}
            <a href={`mailto:${c.email}`} className={buttonClass({ variant: "secondary" })}><Mail className="size-4" /> Email</a>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Date joined", formatDate(c.created_at)],
            ["Last purchase", valid[0] ? formatDate(valid[0].created_at) : "-"],
            ["Total orders", String(valid.length)],
            ["Total spend", kes(spend)],
            ["Loyalty points", String(c.loyalty_points)],
            ["Marketing consent", c.marketing_consent ? "Yes" : "No"],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-lg font-bold">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-muted">
          Prefers updates by {[c.notify_whatsapp && "WhatsApp", c.notify_sms && "SMS", c.notify_email && "email"].filter(Boolean).join(", ") || "-"}
          {c.date_of_birth ? ` · Birthday ${new Date(`${c.date_of_birth}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "long", timeZone: "UTC" })}` : ""}
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Purchase history" subtitle="Online and in-store" />
          <ul className="divide-y divide-line">
            {(orders ?? []).map((o) => (
              <li key={o.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link>
                  <div className="flex items-center gap-2"><Badge tone={o.channel === "pos" ? "neutral" : "brand"}>{o.channel === "pos" ? "POS" : "Online"}</Badge><StatusBadge status={o.status} /><span className="font-semibold">{kes(o.total_amount)}</span></div>
                </div>
                <p className="text-sm text-ink-muted">{formatDateTime(o.created_at)} · {o.order_items.map((i: { quantity: number; product_name: string }) => `${i.quantity}× ${i.product_name}`).join(", ")}</p>
              </li>
            ))}
            {!orders?.length && <li className="px-5 py-6 text-ink-muted">No purchases yet.</li>}
          </ul>
        </Card>
        <div className="space-y-6">
          {insight && <AiCard title="Customer insight">{insight}</AiCard>}
          <Card>
            <CardHeader title="Preferred products" />
            <ul className="divide-y divide-line">
              {preferred.map(([name, qty]) => <li key={name} className="flex justify-between px-5 py-2.5 text-[15px]"><span>{name}</span><span className="text-ink-muted">{qty} bought</span></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Quick messages" subtitle="Opens WhatsApp with a ready message. Nothing is sent automatically." />
            <div className="grid gap-2 p-5">
              {templates.map(({ Icon, label, text }) => (
                <a key={label} href={wa(text) ?? "#"} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary" }) + " justify-start"}>
                  <Icon className="size-4" /> {label}
                </a>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Loyalty" subtitle={`${c.loyalty_points} points`} />
            <ul className="divide-y divide-line">
              {(loyalty ?? []).map((t) => <li key={t.id} className="flex justify-between px-5 py-2.5 text-[15px]"><span>{t.reason}<span className="block text-xs text-ink-muted">{formatDate(t.created_at)}</span></span><span className="font-semibold text-mint-fg">+{t.points}</span></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <ul className="divide-y divide-line">
              {(notes ?? []).map((n) => <li key={n.id} className="px-5 py-3 text-[15px]">{n.note}<span className="block text-xs text-ink-muted">{(n.by as unknown as { full_name: string } | null)?.full_name} · {formatDate(n.created_at)}</span></li>)}
              {!notes?.length && <li className="px-5 py-3 text-ink-muted">No notes.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
