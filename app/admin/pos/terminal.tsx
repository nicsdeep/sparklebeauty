"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Banknote, CheckCircle2, CreditCard, Minus, Plus, Printer, ScanBarcode, Search, Smartphone, Trash2, UserRound, X } from "lucide-react";
import { Badge, Button, cx, inputClass } from "@/components/ui";
import { kes, maskPhone, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";
import { completeSale, type PosSaleResult } from "../actions";

export type PosItem = { variantId: string; sku: string; name: string; variantName: string | null; category: string; group: string; retail: number; wholesale: number; available: number; low: boolean };
export type PosCustomer = { id: string; name: string; phone: string; email: string; points: number; business: string | null };

const GROUPS = [["all", "All"], ["hair", "Hair"], ["cosmetics", "Cosmetics"], ["skincare", "Skincare"], ["perfumes", "Perfumes"], ["accessories", "Accessories"]];

type Line = { item: PosItem; qty: number };
type Receipt = PosSaleResult & { lines: Line[]; tier: "retail" | "wholesale"; customer: PosCustomer | null; method: PaymentMethod; subtotal: number; discount: number; tendered?: number; at: string };

export function PosTerminal({ items, customers, wholesaleMin }: { items: PosItem[]; customers: PosCustomer[]; wholesaleMin: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [tier, setTier] = useState<"retail" | "wholesale">("retail");
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [tendered, setTendered] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [mpesaPrompt, setMpesaPrompt] = useState(false);
  const [pending, start] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (group === "all" || i.group === group) && (!q || `${i.name} ${i.variantName ?? ""} ${i.sku}`.toLowerCase().includes(q))).slice(0, 60);
  }, [items, query, group]);
  const matchingCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => `${c.name} ${c.phone} ${c.business ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customerQuery]);

  const price = (i: PosItem) => (tier === "wholesale" ? i.wholesale : i.retail);
  const inCart = (id: string) => lines.find((l) => l.item.variantId === id)?.qty ?? 0;
  const subtotal = lines.reduce((s, l) => s + price(l.item) * l.qty, 0);
  const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = subtotal - disc;
  const qtyTotal = lines.reduce((s, l) => s + l.qty, 0);
  const change = Math.max(0, (Number(tendered) || 0) - total);
  const wholesaleShort = tier === "wholesale" && qtyTotal < wholesaleMin;

  function addItem(item: PosItem) {
    setError(null);
    if (inCart(item.variantId) >= item.available) { setError(`Only ${item.available} of ${item.name} in stock.`); return; }
    setLines((prev) => prev.some((l) => l.item.variantId === item.variantId)
      ? prev.map((l) => (l.item.variantId === item.variantId ? { ...l, qty: l.qty + 1 } : l))
      : [...prev, { item, qty: 1 }]);
  }
  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.flatMap((l) => (l.item.variantId !== id ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, l.item.available) }])));

  function scan(e: FormEvent) {
    e.preventDefault();
    const code = query.trim().toLowerCase();
    const hit = items.find((i) => i.sku.toLowerCase() === code) ?? (shown.length === 1 ? shown[0] : null);
    if (hit) { addItem(hit); setQuery(""); }
  }

  function pickCustomer(c: PosCustomer | null) {
    setCustomer(c);
    setCustomerQuery("");
    setPhone(c?.phone ?? "");
    if (!c?.business) setTier("retail");
  }

  function charge() {
    setError(null);
    if (method === "mpesa" && !mpesaPrompt) { setMpesaPrompt(true); return; }
    start(async () => {
      const res = await completeSale({
        customerId: customer?.id ?? null,
        tier,
        items: lines.map((l) => ({ variant_id: l.item.variantId, quantity: l.qty })),
        discount: disc,
        paymentMethod: method,
        amountTendered: method === "cash" ? Number(tendered) || 0 : undefined,
        mpesaPhone: method === "mpesa" ? phone : undefined,
      });
      setMpesaPrompt(false);
      if (!res.ok) { setError(res.error); return; }
      setReceipt({ ...res.data, lines, tier, customer, method, subtotal, discount: disc, tendered: Number(tendered) || undefined, at: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }) });
    });
  }

  function newSale() {
    setReceipt(null);
    setLines([]);
    setDiscount("");
    setTendered("");
    pickCustomer(null);
    setMethod("mpesa");
    router.refresh();
    setTimeout(() => scanRef.current?.focus(), 50);
  }

  const canCharge = lines.length > 0 && !wholesaleShort && !pending && (method !== "cash" || (Number(tendered) || 0) >= total) && (method !== "mpesa" || phone.replace(/\D/g, "").length >= 9);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      {/* Products */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <div className="flex rounded-full border border-line bg-white p-1" role="radiogroup" aria-label="Price list">
            {(["retail", "wholesale"] as const).map((t) => (
              <button key={t} role="radio" aria-checked={tier === t} disabled={t === "wholesale" && !customer?.business}
                onClick={() => setTier(t)} title={t === "wholesale" && !customer?.business ? "Select a wholesale customer first" : undefined}
                className={cx("rounded-full px-5 py-2 text-sm font-semibold capitalize disabled:cursor-not-allowed disabled:opacity-40",
                  tier === t ? (t === "wholesale" ? "bg-info-fg text-white" : "bg-brand-600 text-white") : "")}>
                {t} prices
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={scan} className="relative">
          <ScanBarcode className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <input ref={scanRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className={cx(inputClass, "h-13 rounded-2xl pl-12 text-base")}
            placeholder="Search product, or scan / type SKU and press Enter" aria-label="Search products or scan barcode" />
        </form>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map(([id, label]) => (
            <button key={id} onClick={() => setGroup(id)} className={cx("rounded-full px-4 py-2 text-sm font-semibold", group === id ? "bg-ink text-white" : "border border-line bg-white")}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {shown.map((i) => {
            const left = i.available - inCart(i.variantId);
            return (
              <button key={i.variantId} onClick={() => addItem(i)} disabled={left <= 0}
                className="flex min-h-28 flex-col rounded-2xl border border-line bg-white p-3 text-left transition hover:border-brand-500 disabled:opacity-50">
                <span className="font-semibold leading-snug">{i.name}</span>
                {i.variantName && <span className="text-sm text-ink-muted">{i.variantName}</span>}
                <span className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <span className={cx("font-bold", tier === "wholesale" ? "text-info-fg" : "text-brand-700")}>{kes(price(i))}</span>
                  <span className={cx("text-xs font-semibold", left <= 0 ? "text-rose-fg" : i.low ? "text-amber-fg" : "text-ink-muted")}>{left <= 0 ? "Out" : `${left} left`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sale */}
      <section className="h-fit space-y-4 rounded-2xl border border-line bg-white p-4 xl:sticky xl:top-20">
        <div>
          <p className="mb-2 text-sm font-semibold">Customer</p>
          {customer ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <UserRound className="size-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-semibold">{customer.business ?? customer.name}</p>
                <p className="text-sm text-ink-muted">{customer.business ? `${customer.name} · ` : ""}{customer.phone} · {customer.points} pts</p>
              </div>
              {customer.business && <Badge tone="info">Wholesale</Badge>}
              <button onClick={() => pickCustomer(null)} aria-label="Remove customer" className="p-1"><X className="size-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} className={cx(inputClass, "pl-10")} placeholder="Walk-in customer · search name or phone" aria-label="Find customer" />
              {matchingCustomers.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                  {matchingCustomers.map((c) => (
                    <li key={c.id}><button onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface">
                      <span><span className="font-semibold">{c.business ?? c.name}</span><span className="block text-sm text-ink-muted">{c.phone}</span></span>
                      {c.business && <Badge tone="info">Wholesale</Badge>}
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={cx("rounded-xl px-3 py-2 text-sm font-semibold", tier === "wholesale" ? "bg-info-bg text-info-fg" : "bg-brand-50 text-brand-700")}>
          {tier === "wholesale" ? `Wholesale prices · minimum ${wholesaleMin} items` : "Retail prices"}
        </div>

        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {lines.map((l) => (
            <li key={l.item.variantId} className="flex items-center gap-2 py-2.5">
              <div className="flex-1">
                <p className="font-semibold leading-snug">{l.item.name}</p>
                <p className="text-sm text-ink-muted">{l.item.variantName ? `${l.item.variantName} · ` : ""}{kes(price(l.item))}</p>
              </div>
              <div className="flex items-center rounded-full border border-line">
                <button className="p-2" onClick={() => setQty(l.item.variantId, l.qty - 1)} aria-label="Less"><Minus className="size-4" /></button>
                <input value={l.qty} onChange={(e) => setQty(l.item.variantId, Number(e.target.value) || 0)} className="w-9 text-center font-semibold" inputMode="numeric" aria-label="Quantity" />
                <button className="p-2" onClick={() => setQty(l.item.variantId, l.qty + 1)} aria-label="More"><Plus className="size-4" /></button>
              </div>
              <span className="w-24 text-right font-semibold">{kes(price(l.item) * l.qty)}</span>
              <button onClick={() => setQty(l.item.variantId, 0)} aria-label="Remove" className="p-1 text-ink-muted hover:text-rose-fg"><Trash2 className="size-4" /></button>
            </li>
          ))}
          {!lines.length && <li className="py-8 text-center text-ink-muted">Tap a product or scan a barcode to start a sale.</li>}
        </ul>

        <dl className="space-y-2 border-t border-line pt-3 text-[15px]">
          <div className="flex justify-between"><dt>Subtotal ({qtyTotal} items)</dt><dd>{kes(subtotal)}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt>Discount (KES)</dt>
            <dd><input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="h-9 w-28 rounded-lg border border-line px-2 text-right" placeholder="0" aria-label="Discount" /></dd></div>
          <div className="flex justify-between text-xl font-bold"><dt>Total</dt><dd>{kes(total)}</dd></div>
        </dl>
        {wholesaleShort && <p className="rounded-xl bg-amber-bg px-3 py-2 text-sm text-amber-fg">Add {wholesaleMin - qtyTotal} more items to qualify for wholesale prices.</p>}

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
          {([["mpesa", Smartphone], ["cash", Banknote], ["card", CreditCard]] as const).map(([m, Icon]) => (
            <button key={m} role="radio" aria-checked={method === m} onClick={() => { setMethod(m); setMpesaPrompt(false); }}
              className={cx("flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold", method === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line")}>
              <Icon className="size-5" /> {PAYMENT_LABEL[m]}
            </button>
          ))}
        </div>
        {method === "mpesa" && <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Customer M-Pesa number" inputMode="tel" aria-label="M-Pesa phone" />}
        {method === "cash" && (
          <div className="flex items-center gap-3">
            <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d]/g, ""))} className={inputClass} placeholder="Cash received (KES)" inputMode="numeric" aria-label="Cash received" />
            <span className="whitespace-nowrap text-[15px]">Change <strong>{kes(change)}</strong></span>
          </div>
        )}
        {mpesaPrompt && (
          <div className="rounded-xl bg-mint-bg p-3 text-[15px] text-mint-fg">
            M-Pesa request sent to <strong>{maskPhone(phone)}</strong> for <strong>{kes(total)}</strong>. Ask the customer to enter their PIN.
          </div>
        )}
        {error && <p className="rounded-xl bg-rose-bg px-3 py-2 text-sm text-rose-fg" role="alert">{error}</p>}
        <Button size="lg" className="w-full text-lg" disabled={!canCharge} onClick={charge}>
          {pending ? "Completing…" : method === "mpesa" && mpesaPrompt ? "Simulate M-Pesa Payment & Complete Sale" : method === "mpesa" ? `Send M-Pesa Request · ${kes(total)}` : `Complete Sale · ${kes(total)}`}
        </Button>
      </section>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Receipt">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6">
            <div className="text-center">
              <CheckCircle2 className="no-print mx-auto size-12 text-mint-fg" />
              <p className="mt-2 text-xl font-extrabold text-brand-600">Sparkle Beauty &amp; Cosmetics</p>
              <p className="text-sm text-ink-muted">Moi Avenue, Nairobi · 0702 388 724</p>
              <p className="mt-3 font-semibold">Receipt {receipt.orderNumber}</p>
              <p className="text-sm text-ink-muted">{receipt.at} · {receipt.tier === "wholesale" ? "Wholesale" : "Retail"}</p>
              {receipt.customer && <p className="text-sm">{receipt.customer.business ?? receipt.customer.name}</p>}
            </div>
            <ul className="mt-4 space-y-1.5 border-y border-dashed border-line py-3 text-sm">
              {receipt.lines.map((l) => (
                <li key={l.item.variantId} className="flex justify-between gap-3">
                  <span>{l.qty} × {l.item.name}{l.item.variantName ? ` ${l.item.variantName}` : ""}</span>
                  <span>{kes((receipt.tier === "wholesale" ? l.item.wholesale : l.item.retail) * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{kes(receipt.subtotal)}</dd></div>
              {receipt.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{kes(receipt.discount)}</dd></div>}
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{kes(receipt.total)}</dd></div>
              <div className="flex justify-between"><dt>Paid by {PAYMENT_LABEL[receipt.method]}</dt><dd className="font-mono">{receipt.reference}</dd></div>
              {receipt.method === "cash" && <div className="flex justify-between"><dt>Cash / Change</dt><dd>{kes(receipt.tendered)} / {kes(receipt.change)}</dd></div>}
              {receipt.customer && !receipt.customer.business && <div className="flex justify-between"><dt>Points earned</dt><dd>+{Math.floor(receipt.total / 100)}</dd></div>}
            </dl>
            <p className="mt-4 text-center text-sm text-ink-muted">Thank you for shopping with Sparkle!</p>
            <div className="no-print mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button onClick={newSale}>New Sale</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
