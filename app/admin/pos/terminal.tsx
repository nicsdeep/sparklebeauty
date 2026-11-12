"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote, BadgePercent, CheckCircle2, ChevronDown, CircleAlert, Clock, CreditCard, History, Mail, Minus, PackagePlus, PauseCircle, Plus,
  Landmark, Printer, RefreshCw, ScanBarcode, Search, ShoppingCart, Smartphone, Trash2, UserPlus, UserRound, WifiOff, X,
} from "lucide-react";
import { Badge, Button, buttonClass, cx, inputClass } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { formatDateTime, kes, maskPhone } from "@/lib/format";
import { useLiveTopic } from "@/lib/live";
import { orderTax, type TaxType } from "@/lib/tax";
import { vatHeading } from "@/lib/invoices";
import type { ReceiptData } from "@/lib/receipt";
import { ReceiptActions } from "@/components/receipt-actions";
import { ReceiptDocument } from "@/components/receipt-document";
import { breakFor, ruleLabel, type PriceBreak, type PriceRule, type QuoteLine } from "@/lib/pricing";
import { incentives } from "@/lib/incentives";
import type { StoreSettings } from "@/lib/store-types";
import {
  completeSale, listSuspensions, posPriceSheet, posQuote, releaseSuspension, suspendSale,
  type PosPaymentMethod, type PosReceiptLine, type PosRecordedPayment, type PosSaleResult, type PosSuspension,
} from "../actions";
import { loadQueue, newClientRef, saveQueue, type QueuedSale } from "./offline-queue";
import { ProductFinder } from "./product-finder";

export type PosItem = {
  variantId: string; productId: string; sku: string; name: string; variantName: string | null; image: string | null;
  category: string; group: string; retail: number; available: number; low: boolean;
  /** Brand (used as supplier) and the variant's attributes, for search, filters and the variant picker. */
  brand: string | null; color: string | null; shade: string | null; size: string | null; length: string | null;
  /** eTIMS tax type and VAT % (prices include VAT; the VAT inside them goes on the receipt and invoice). */
  taxType: TaxType; taxRate: number;
};
export type PosCustomer = { id: string; name: string; phone: string; email: string; points: number; business: string | null };
export type PosCategory = { slug: string; name: string };

type Line = { variantId: string; qty: number };
/** One part of the payment. amount "" means "whatever is left to pay" (for M-Pesa, card or bank). */
type Tender = { id: string; method: PosPaymentMethod; amount: string; phone: string; reference: string };
/** The shared receipt (lib/receipt.ts) plus the customer, to prefill where it's sent. */
type Receipt = ReceiptData & { customerRef: PosCustomer | null };
type Sheet = Record<string, PriceBreak[]>;

const MAX_TENDERS = 5;
const CART_KEY = "sparkle-pos-cart-v1";
const METHODS = [["mpesa", Smartphone], ["cash", Banknote], ["card", CreditCard], ["bank_transfer", Landmark]] as const;
const SHORT_LABEL: Record<PosPaymentMethod, string> = { mpesa: "M-Pesa", cash: "Cash", card: "Card", bank_transfer: "Bank" };
const isMpesaCode = (v: string) => /^[A-Z0-9]{8,12}$/i.test(v.trim());
const newTender = (method: PosPaymentMethod, phone = ""): Tender => ({ id: Math.random().toString(36).slice(2), method, amount: "", phone, reference: "" });

/** Amount each tender pays: typed amounts as entered; the last blank M-Pesa/card/bank one takes the balance. */
function settle(tenders: Tender[], total: number) {
  const typed = tenders.map((t) => (t.amount === "" ? null : Number(t.amount) || 0));
  const fixed = typed.reduce<number>((a, v) => a + (v ?? 0), 0);
  const auto = tenders.map((t, i) => (t.amount === "" && t.method !== "cash" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const amounts = typed.map((v, i) => v ?? (i === auto ? Math.max(0, total - fixed) : 0));
  const paid = amounts.reduce((a, v) => a + v, 0);
  const cash = amounts.reduce((a, v, i) => a + (tenders[i].method === "cash" ? v : 0), 0);
  const nonCash = paid - cash;
  return { amounts, paid, cash, nonCash, balance: Math.max(0, total - paid), change: Math.max(0, paid - total), overCharged: nonCash > total };
}
const isNetworkError = (e: unknown) => e instanceof TypeError || /fetch|network|failed to fetch/i.test(String((e as Error)?.message ?? e));

export function PosTerminal({ items, categories, customers, walkInSheet, threshold, store, cashier, activity }: {
  items: PosItem[]; categories: PosCategory[]; customers: PosCustomer[]; walkInSheet: Sheet; threshold: number;
  store: StoreSettings; cashier: string | null;
  /** Variant ids by real sales: best sellers (90 days), fast movers (7 days), this cashier's recent sales. */
  activity: { quick: string[]; fast: string[]; recent: string[] };
}) {
  const router = useRouter();
  const itemsBy = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);

  // Sale being built
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [discountPct, setDiscountPct] = useState("");
  const [tenders, setTenders] = useState<Tender[]>(() => [newTender("mpesa")]);
  const [mpesaSent, setMpesaSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

  // Browsing
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [panel, setPanel] = useState<null | "suspend" | "manual" | "sync">(null);
  // Below the lg breakpoint the sale panel is a drawer opened from the bar at the bottom.
  const [cartOpen, setCartOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(null), 1800); return () => clearTimeout(t); }, [added]);
  // Suspended sales (database) and the one loaded into the cart, if any.
  const [suspensions, setSuspensions] = useState<PosSuspension[]>([]);
  const [resumed, setResumed] = useState<PosSuspension | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  // Pricing: the engine's breaks per customer; server confirmation of the current cart.
  const [sheets, setSheets] = useState<Record<string, Sheet>>({ "walk-in": walkInSheet });
  const [confirmed, setConfirmed] = useState<{ key: string; lines: Record<string, QuoteLine> } | null>(null);
  const sheetKey = customer?.id ?? "walk-in";
  const sheet = sheets[sheetKey];

  // Connection and offline queue
  const [navOnline, setNavOnline] = useState(true);
  const [serverOk, setServerOk] = useState(true);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const online = navOnline && serverOk;

  useEffect(() => {
    setQueue(loadQueue());
    const up = () => { setNavOnline(true); setServerOk(true); };
    const down = () => setNavOnline(false);
    setNavOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(tick); };
  }, []);
  useEffect(() => { setSheets((s) => ({ ...s, "walk-in": walkInSheet })); }, [walkInSheet]);

  // Load the selected customer's price breaks (cached for offline use).
  useEffect(() => {
    if (!customer || sheets[customer.id] || !online) return;
    posPriceSheet(customer.id).then((r) => { if (r.ok) setSheets((s) => ({ ...s, [customer.id]: r.data })); }).catch(() => setServerOk(false));
  }, [customer, sheets, online]);

  const cartKey = `${sheetKey}|${lines.map((l) => `${l.variantId}:${l.qty}`).join(",")}`;
  const confirm = useCallback(async (key: string, cust: string | null, ls: Line[]) => {
    try {
      const res = await posQuote(cust, ls.map((l) => ({ variant_id: l.variantId, quantity: l.qty })));
      if (res.ok) setConfirmed({ key, lines: Object.fromEntries(res.data.map((q) => [q.variant_id, q])) });
      setServerOk(true);
    } catch (e) { if (isNetworkError(e)) setServerOk(false); }
  }, []);
  useEffect(() => {
    if (!lines.length || !online) return;
    const t = setTimeout(() => confirm(cartKey, customer?.id ?? null, lines), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, online]);

  // Live: another channel sold or restocked something in this cart -> re-confirm it.
  const liveCart = useRef({ key: cartKey, customer: customer?.id ?? null, lines });
  liveCart.current = { key: cartKey, customer: customer?.id ?? null, lines };
  const live = useLiveTopic("catalog", (event, payload) => {
    const c = liveCart.current;
    if (c.lines.length && (event === "catalog" || c.lines.some((l) => l.variantId === payload.variant_id))) confirm(c.key + "*", c.customer, c.lines);
  });

  /** Price of a line: the server's confirmed quote, else the engine's break for this quantity. */
  const priceOf = (l: Line): { unit: number; rule: PriceRule; minQty: number; retail: number; available: number } => {
    const item = itemsBy.get(l.variantId);
    const q = confirmed?.lines[l.variantId];
    const exact = q && q.quantity === l.qty && confirmed!.key.startsWith(cartKey);
    const b = breakFor(sheet?.[l.variantId], l.qty);
    return {
      unit: exact ? q.unit_price : b?.unit_price ?? item?.retail ?? 0,
      rule: exact ? q.rule : b?.rule ?? "retail",
      minQty: (exact ? breakFor(q.breaks, q.quantity) : b)?.min_qty ?? 1,
      retail: item?.retail ?? 0,
      available: q ? q.available : item?.available ?? 0,
    };
  };
  const priced = lines.map((l) => ({ ...l, item: itemsBy.get(l.variantId)!, price: priceOf(l) })).filter((l) => l.item);
  const subtotal = priced.reduce((s, l) => s + l.price.unit * l.qty, 0);
  const pct = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const discount = Math.round((subtotal * pct) / 100);
  // VAT inside the (VAT-inclusive) prices, to the cent as the server will record it.
  const vat = orderTax(priced.map((l) => ({ amount: l.price.unit * l.qty, rate: l.item.taxRate })), discount);
  const total = vat.total;
  const units = priced.reduce((s, l) => s + l.qty, 0);
  const pay = settle(tenders, total);
  // Same rule as the website cart (lib/incentives): the product closest to its wholesale break.
  // No delivery at the till, so no free-delivery nudge.
  const nudges = incentives(priced.map((l) => ({ name: l.item.name, quantity: l.qty, breaks: sheet?.[l.variantId], available: l.price.available })));
  const allConfirmed = !online || priced.every((l) => confirmed?.key.startsWith(cartKey) && confirmed.lines[l.variantId]?.quantity === l.qty);

  const matchingCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return customers.filter((c) => !q || `${c.name} ${c.phone} ${c.business ?? ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const qtyOf = (id: string) => lines.find((l) => l.variantId === id)?.qty ?? 0;
  function addItem(item: PosItem, qty = 1) {
    setError(null);
    const want = qtyOf(item.variantId) + qty;
    const max = item.available + heldFor(item.variantId);
    if (want > max) { setError(`Only ${max} of ${item.name} in stock${online ? "" : " (last known)"}.`); return; }
    setLines((prev) => (prev.some((l) => l.variantId === item.variantId)
      ? prev.map((l) => (l.variantId === item.variantId ? { ...l, qty: want } : l))
      : [...prev, { variantId: item.variantId, qty }]));
    setAdded(`Added ${item.name}${item.variantName ? ` (${item.variantName})` : ""}`);
  }
  const setQty = (id: string, qty: number) => setLines((prev) => prev.flatMap((l) => {
    if (l.variantId !== id) return [l];
    if (qty <= 0) return [];
    const max = (itemsBy.get(id)?.available ?? qty) + heldFor(id);
    if (qty > max) setError(`Only ${max} in stock${online ? "" : " (last known)"}.`);
    return [{ ...l, qty: Math.min(qty, max, 500) }];
  }));

  function pickCustomer(c: PosCustomer | null) {
    if (c && !online && !sheets[c.id]) { setError("Offline: this customer's prices aren't loaded on this till, so they can't be selected until the connection returns."); return; }
    setCustomer(c);
    setCustomerQuery("");
    setCustomerOpen(false);
    setTenders((ts) => ts.map((t) => (t.method === "mpesa" && !t.phone ? { ...t, phone: c?.phone ?? "" } : t)));
    setConfirmed(null);
  }

  // Payment editing. Any change means a sent M-Pesa request no longer matches, so it is re-sent.
  function updateTender(id: string, patch: Partial<Tender>) {
    setTenders((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch, phone: patch.method === "mpesa" && !t.phone ? customer?.phone ?? "" : patch.phone ?? t.phone } : t)));
    setMpesaSent(false); setError(null);
  }
  function addTender(method: PosPaymentMethod) {
    setTenders((ts) => (ts.length >= MAX_TENDERS ? ts : [...ts, newTender(method, method === "mpesa" ? customer?.phone ?? "" : "")]));
    setMpesaSent(false); setError(null);
  }
  function removeTender(id: string) {
    setTenders((ts) => (ts.length > 1 ? ts.filter((t) => t.id !== id) : ts));
    setMpesaSent(false);
  }

  function resetSale() {
    setLines([]); setDiscountPct(""); setMpesaSent(false); setError(null); setCustomer(null); setResumed(null);
    setTenders([newTender(online ? "mpesa" : "cash")]); setConfirmed(null);
  }
  function newSale() {
    setCartOpen(false);
    if (receipt) setLastReceipt(receipt);
    setReceipt(null);
    resetSale();
    router.refresh();
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function receiptFromCart(number: string, offline: boolean, payments: PosRecordedPayment[], server?: PosSaleResult): Receipt {
    // The server's lines when the sale is recorded; the till's own (same VAT rule) when offline.
    const ls: PosReceiptLine[] = server?.lines ?? priced.map((l, i) => ({ name: l.item.name + (l.item.variantName ? ` – ${l.item.variantName}` : ""), sku: l.item.sku,
      quantity: l.qty, unitPrice: l.price.unit, lineTotal: l.price.unit * l.qty, amount: l.price.unit * l.qty - vat.lines[i].discount, rule: l.price.rule }));
    const grand = server?.total ?? total;
    return {
      number, offline, issuedAt: new Date().toISOString(), cashier, channel: "till", customerRef: customer,
      customer: customer ? customer.business ?? customer.name : "Walk-in customer",
      lines: ls.map((l) => ({ quantity: l.quantity, name: l.name, sku: l.sku || null, amount: l.amount })),
      subtotal: ls.reduce((s, l) => s + l.lineTotal, 0), discount: vat.discount, delivery: 0, tax: server?.tax ?? vat.tax,
      vatLabel: vatHeading(priced.map((l) => l.item.taxRate)), vatIncluded: true, total: grand, payments,
      cashReceived: pay.cash > 0 ? pay.cash : undefined, change: server?.change ?? pay.change, invoiceNumber: server?.invoiceNumber ?? null,
      pointsEarned: customer && !customer.business && !offline ? Math.floor(grand / 100) : undefined,
      token: server?.receiptToken ?? null,
    };
  }

  function queueOffline() {
    const sale: QueuedSale = {
      clientRef: newClientRef(), offlineAt: new Date().toISOString(), customerId: customer?.id ?? null,
      customerName: customer ? customer.business ?? customer.name : null,
      items: priced.map((l) => ({ variant_id: l.variantId, quantity: l.qty, name: l.item.name })),
      discount, amountTendered: pay.cash, chargedTotal: total, status: "pending",
    };
    const next = [...queue, sale];
    setQueue(next); saveQueue(next);
    setReceipt(receiptFromCart(`OFFLINE-${sale.clientRef.slice(0, 6).toUpperCase()}`, true, [{ method: "cash", amount: total, reference: "Pending sync" }]));
  }

  async function charge() {
    setError(null);
    if (!online) {
      if (!allCash || pay.balance > 0) { setError("Offline: take the full amount in cash."); return; }
      queueOffline();
      return;
    }
    if (needsPrompt && !mpesaSent) { setMpesaSent(true); return; }
    setPending(true);
    const clientRef = newClientRef();
    try {
      const res = await completeSale({
        customerId: customer?.id ?? null,
        items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
        discount, clientRef, suspensionId: resumed?.id,
        payments: tenders.map((t, i) => ({ method: t.method, amount: pay.amounts[i], phone: t.method === "mpesa" ? t.phone : undefined, reference: t.reference.trim() || undefined }))
          .filter((p) => p.amount > 0),
      });
      setMpesaSent(false);
      if (!res.ok) { setError(res.error); return; }
      setReceipt(receiptFromCart(res.data.orderNumber, false, res.data.payments, res.data));
      setResumed(null);
    } catch (e) {
      if (!isNetworkError(e)) { setError("Something went wrong. Please try again."); return; }
      setServerOk(false);
      if (allCash && pay.balance === 0) queueOffline();
      else setError("The connection dropped. M-Pesa, card and bank need a connection; take cash or wait for the connection to return.");
    } finally {
      setPending(false);
    }
  }

  // Sync the offline queue whenever we are back online.
  const syncNow = useCallback(async () => {
    const pendingSales = loadQueue();
    if (!pendingSales.some((s) => s.status === "pending") || syncing) return;
    setSyncing(true);
    let current = pendingSales;
    for (const sale of pendingSales.filter((s) => s.status === "pending")) {
      try {
        const res = await completeSale({
          customerId: sale.customerId, items: sale.items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
          discount: sale.discount, payments: [{ method: "cash", amount: sale.amountTendered }], clientRef: sale.clientRef, offlineAt: sale.offlineAt,
        });
        current = res.ok
          ? current.filter((s) => s.clientRef !== sale.clientRef)
          : current.map((s) => (s.clientRef === sale.clientRef ? { ...s, status: "conflict", error: res.error } : s));
        if (res.ok && Math.abs(res.data.total - sale.chargedTotal) >= 1) {
          // Recorded, but prices changed while offline: keep a note for the manager.
          current = [...current, { ...sale, status: "conflict", error: `Recorded as ${res.data.orderNumber} for ${kes(res.data.total)}, but ${kes(sale.chargedTotal)} was charged. Check with a manager.`, clientRef: `${sale.clientRef}-note` }];
        }
      } catch (e) {
        if (isNetworkError(e)) { setServerOk(false); break; }
      }
      setQueue(current); saveQueue(current);
    }
    setSyncing(false);
    router.refresh();
  }, [syncing, router]);
  useEffect(() => {
    if (!online || !queue.some((s) => s.status === "pending")) return;
    syncNow();
    const t = setInterval(syncNow, 20000);
    return () => clearInterval(t);
  }, [online, queue, syncNow]);

  // Suspended sales: held in the database with their stock (24 h by default, see the migration).
  const refreshSuspensions = useCallback(async () => {
    try {
      const res = await listSuspensions();
      if (res.ok) { setSuspensions(res.data); setSuspensionsLoaded(true); }
    } catch (e) { if (isNetworkError(e)) setServerOk(false); }
  }, []);
  const [suspensionsLoaded, setSuspensionsLoaded] = useState(false);
  useEffect(() => { refreshSuspensions(); }, [refreshSuspensions]);
  // Another till suspended, resumed or released one: re-read the list.
  useLiveTopic("admin", () => refreshSuspensions());
  // A countdown reached zero: the server releases it as the list is read.
  const nextExpiry = suspensions.reduce((m, s) => Math.min(m, new Date(s.expiresAt).getTime()), Infinity);
  useEffect(() => { if (nextExpiry <= now.getTime()) refreshSuspensions(); }, [now, nextExpiry, refreshSuspensions]);
  // The suspension in the cart ended elsewhere (released, expired): its stock is no longer held.
  useEffect(() => {
    if (suspensionsLoaded && resumed && !suspensions.some((s) => s.id === resumed.id)) {
      setResumed(null);
      setError(`${resumed.reference} has ended; its items are no longer held. Check stock before taking payment.`);
    }
  }, [suspensions, suspensionsLoaded, resumed]);
  /** Units of this product the resumed suspension already holds (they count as available for it). */
  const heldFor = (id: string) => resumed?.items.find((i) => i.variantId === id)?.quantity ?? 0;

  const [suspendNote, setSuspendNote] = useState("");
  async function suspend() {
    if (!lines.length) return;
    if (!online) { setError("Suspending needs a connection: the stock is held in the database."); return; }
    setPending(true); setError(null);
    try {
      // A resumed sale suspended again: give back its old hold first, then hold the new cart.
      if (resumed) {
        const rel = await releaseSuspension(resumed.id);
        if (!rel.ok) { setError(rel.error); return; }
      }
      const res = await suspendSale({ customerId: customer?.id ?? null, items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.qty })),
        discountPct: Number(discountPct) || 0, notes: suspendNote });
      if (!res.ok) { setError(res.error); return; }
      setAdded(`Suspended as ${res.data.reference}`);
      setSuspendNote(""); setPanel(null); setResumed(null); resetSale(); refreshSuspensions(); router.refresh();
    } catch (e) {
      if (isNetworkError(e)) setServerOk(false);
      setError("Couldn't suspend the sale. Please try again.");
    } finally { setPending(false); }
  }
  function resume(s: PosSuspension) {
    setLines(s.items.filter((i) => itemsBy.has(i.variantId)).map((i) => ({ variantId: i.variantId, qty: i.quantity })));
    setDiscountPct(s.discountPct ? String(s.discountPct) : "");
    const c = customers.find((x) => x.id === s.customerId) ?? null;
    setCustomer(c); setTenders([newTender("mpesa", c?.phone ?? s.customerPhone ?? "")]);
    setResumed(s); setMpesaSent(false); setConfirmed(null); setError(null); setPanel(null);
  }

  // The sale being built survives going to another page (Recent Sales, a sale, Suspended Sales)
  // and back: kept for this browser tab only. Stock and prices are re-read from the database.
  // Saving starts only after the saved cart has been applied (else the empty first render overwrites it).
  const [restored, setRestored] = useState(false);
  const [pendingResume, setPendingResume] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CART_KEY) ?? "null") as { lines: Line[]; customerId: string | null; discountPct: string; resumedId: string | null } | null;
      if (saved) {
        setLines(saved.lines.filter((l) => itemsBy.has(l.variantId)));
        setDiscountPct(saved.discountPct);
        const c = customers.find((x) => x.id === saved.customerId) ?? null;
        setCustomer(c);
        if (c?.phone) setTenders([newTender("mpesa", c.phone)]);
        if (saved.resumedId) setPendingResume(saved.resumedId);
      }
    } catch { /* storage unavailable: start empty */ }
    // Resume chosen on the Suspended Sales page (/admin/pos?resume=<id>).
    const fromLink = new URLSearchParams(window.location.search).get("resume");
    if (fromLink) { setPendingResume(fromLink); router.replace("/admin/pos", { scroll: false }); }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(CART_KEY, JSON.stringify({ lines, customerId: customer?.id ?? null, discountPct, resumedId: resumed?.id ?? null })); } catch { /* ignore */ }
  }, [restored, lines, customer, discountPct, resumed]);
  // Once the suspended sales are loaded, resume the one asked for (or keep the one already in the cart).
  useEffect(() => {
    if (!pendingResume || !suspensionsLoaded) return;
    const s = suspensions.find((x) => x.id === pendingResume);
    setPendingResume(null);
    if (!s) { setError("That suspended sale has ended."); return; }
    if (resumed?.id === s.id) return;
    if (lines.length && !resumed && !window.confirm(`Replace the current cart with ${s.reference}?`)) return;
    resume(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResume, suspensionsLoaded, suspensions]);

  // Keyboard shortcuts (shown on the quick-action buttons).
  const actions = {
    F2: () => searchRef.current?.focus(),
    F3: () => setPanel("manual"),
    F4: () => discountRef.current?.focus(),
    F5: () => window.open("/admin/customers/new", "_blank"),
    F6: () => lines.length && setPanel("suspend"),
    F7: () => router.push("/admin/pos/suspended"),
  } as Record<string, () => void>;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (actions[e.key]) { e.preventDefault(); actions[e.key](); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const allCash = tenders.every((t) => t.method === "cash");
  // M-Pesa parts without a code the customer already has go through the (simulated) phone prompt.
  const promptTenders = tenders.filter((t, i) => t.method === "mpesa" && !isMpesaCode(t.reference) && pay.amounts[i] > 0);
  const needsPrompt = promptTenders.length > 0;
  const promptAmount = tenders.reduce((a, t, i) => a + (promptTenders.includes(t) ? pay.amounts[i] : 0), 0);
  const paymentProblem = !online && !allCash ? "Offline: only cash can be taken."
    : pay.overCharged ? "M-Pesa, card and bank add up to more than the total."
    : tenders.some((t) => t.method === "mpesa" && t.reference.trim() && !isMpesaCode(t.reference)) ? "An M-Pesa code is 10 letters and numbers, e.g. SGH7K2LMQP."
    : promptTenders.some((t) => t.phone.replace(/\D/g, "").length < 9) ? "Enter the customer's M-Pesa number, or the M-Pesa code if they already paid."
    : null;
  const canCharge = priced.length > 0 && !pending && allConfirmed && pay.balance === 0 && !paymentProblem;
  const conflicts = queue.filter((s) => s.status === "conflict").length;
  const waiting = queue.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Till header: connection and time */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold"><span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white"><ShoppingCart className="size-5" /></span>Point of Sale</h1>
        <button onClick={() => setPanel("sync")} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">
          {online ? <span className="size-2.5 rounded-full bg-mint-fg" /> : <WifiOff className="size-4 text-rose-fg" />}
          {online ? "Online" : "Offline"}
          <span className={cx("rounded-full px-2 py-0.5 text-xs", syncing ? "bg-info-bg text-info-fg" : conflicts ? "bg-rose-bg text-rose-fg" : waiting ? "bg-amber-bg text-amber-fg" : online && live === "live" ? "bg-mint-bg text-mint-fg" : "bg-surface text-ink-muted")}>
            {syncing ? `Syncing ${waiting}…` : conflicts ? `${conflicts} need attention` : waiting ? `${waiting} waiting to sync` : online ? (live === "live" ? "Live with website" : "Connecting…") : "Cash sales only"}
          </span>
        </button>
        <span className="ml-auto flex items-center gap-2 text-sm text-ink-muted"><Clock className="size-4" />
          {now.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" })} · {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}
        </span>
      </div>
      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-bg px-4 py-2.5 text-sm text-amber-fg" role="status">
          <CircleAlert className="size-4 shrink-0" /> No connection. Cash sales are saved on this till and sent when the connection returns. Stock shown is the last known count, not live.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Products */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={newSale}><Plus className="size-4" /> New Sale</Button>
            <Link href="/admin/pos/sales" className={cx(buttonClass({ variant: "ghost" }), "border border-line bg-white")}><History className="size-4" /> Recent Sales</Link>
            <Link href="/admin/pos/suspended" className={cx(buttonClass({ variant: "ghost" }), "border bg-white", suspensions.length ? "border-brand-200 text-brand-700" : "border-line")}>
              <PauseCircle className="size-4" /> Suspended Sales ({suspensions.length})
            </Link>
          </div>

          <ProductFinder items={items} categories={categories} sheet={sheet} activity={activity} online={online} searchRef={searchRef} qtyOf={qtyOf} onAdd={(i) => addItem(i)} />

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {([["F2", "Scan Barcode", ScanBarcode], ["F3", "Manual Product", PackagePlus], ["F4", "Apply Discount", BadgePercent],
               ["F5", "Add Customer", UserPlus], ["F6", "Suspend Sale", PauseCircle], ["F7", "Suspended Sales", History]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={actions[key]} disabled={key === "F6" && !lines.length}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/30 disabled:opacity-40">
                <Icon className="size-4" strokeWidth={1.7} />{label}<kbd className="rounded bg-surface px-1 text-[10px] text-ink-muted">{key}</kbd>
              </button>
            ))}
          </div>
        </section>

        {/* Sale */}
        {cartOpen && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setCartOpen(false)} aria-hidden />}
        <section aria-label="Current sale" className={cx("h-fit space-y-4 border border-line bg-white p-4",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[92vh] max-lg:overflow-y-auto max-lg:rounded-t-3xl max-lg:shadow-2xl",
          "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:rounded-2xl", !cartOpen && "max-lg:hidden")}>
          <div className="flex items-center justify-between lg:hidden">
            <p className="text-lg font-bold">Current sale</p>
            <button onClick={() => setCartOpen(false)} aria-label="Back to products" className="rounded-full p-2 hover:bg-surface"><X className="size-5" /></button>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Customer</p>
              <a href="/admin/customers/new" target="_blank" className="text-sm font-semibold text-brand-700">New Customer ›</a></div>
            <div className="relative">
              <button onClick={() => setCustomerOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left hover:border-brand-200" aria-expanded={customerOpen}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><UserRound className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{customer ? customer.business ?? customer.name : "Walk-in Customer"}</span>
                  <span className="block truncate text-sm text-ink-muted">{customer ? `${customer.business ? `${customer.name} · ` : ""}${customer.phone}${customer.business ? "" : ` · ${customer.points} pts`}` : "Retail price"}</span>
                </span>
                {customer?.business && <Badge tone="teal">Wholesale</Badge>}
                <ChevronDown className="size-5 text-ink-muted" />
              </button>
              {customerOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                  <div className="relative border-b border-line p-2"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                    <input autoFocus value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} className={cx(inputClass, "h-10 pl-9")} placeholder="Search name, phone or business" aria-label="Find customer" /></div>
                  <ul className="max-h-72 overflow-y-auto">
                    <li><button onClick={() => pickCustomer(null)} className="w-full px-3 py-2.5 text-left font-semibold hover:bg-surface">Walk-in Customer</button></li>
                    {matchingCustomers.map((c) => (
                      <li key={c.id}><button onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface">
                        <span><span className="font-semibold">{c.business ?? c.name}</span><span className="block text-sm text-ink-muted">{c.phone}</span></span>
                        {c.business && <Badge tone="teal">Wholesale</Badge>}
                      </button></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className={cx("mt-2 rounded-xl px-3 py-2 text-xs font-medium", customer?.business ? "bg-teal-bg text-teal-fg" : "bg-amber-bg text-amber-fg")}>
              {customer?.business ? `Wholesale pricing active for ${customer.business}.`
                : `Retail pricing applied. Wholesale price applies automatically at ${threshold}+ units of a product, or select a wholesale customer.`}
            </p>
          </div>

          {resumed && (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <PauseCircle className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">Resumed <strong>{resumed.reference}</strong>: its stock stays held until you take payment.</span>
            </p>
          )}
          <div className="rounded-xl bg-surface/70">
            <div className="flex items-center justify-between px-3 pt-3"><p className="font-semibold">Cart ({units} item{units === 1 ? "" : "s"})</p></div>
            <ul className="max-h-96 divide-y divide-line overflow-y-auto px-3">
              {priced.map((l) => {
                const label = ruleLabel(l.price.rule, l.price.minQty);
                return (
                  <li key={l.variantId} className="flex gap-3 py-3">
                    <span className="size-14 shrink-0"><ProductImage category={l.item.category} name={l.item.name} image={l.item.image} size="sm" className="rounded-lg" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug">{l.item.name}</p>
                        <button onClick={() => setQty(l.variantId, 0)} aria-label={`Remove ${l.item.name}`} className="text-rose-fg"><Trash2 className="size-4" /></button>
                      </div>
                      {l.item.variantName && <p className="text-xs text-ink-muted">{l.item.variantName}</p>}
                      {label && <p className="mt-1 inline-flex rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-fg">{label}</p>}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm">{kes(l.price.unit)}{l.price.unit < l.price.retail && <span className="ml-1 text-xs text-ink-muted line-through">{kes(l.price.retail)}</span>}</span>
                        <span className="flex items-center rounded-full border border-line bg-white">
                          <button className="p-1.5" onClick={() => setQty(l.variantId, l.qty - 1)} aria-label="Less"><Minus className="size-4" /></button>
                          <input value={l.qty} onChange={(e) => setQty(l.variantId, Number(e.target.value.replace(/\D/g, "")) || 0)} className="w-9 bg-transparent text-center text-sm font-semibold" inputMode="numeric" aria-label={`Quantity of ${l.item.name}`} />
                          <button className="p-1.5" onClick={() => setQty(l.variantId, l.qty + 1)} aria-label="More"><Plus className="size-4" /></button>
                        </span>
                        <span className="w-24 text-right text-sm font-bold">{kes(l.price.unit * l.qty)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
              {!lines.length && <li className="py-8 text-center text-sm text-ink-muted">Tap a product or scan a barcode to start a sale.</li>}
            </ul>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            <BadgePercent className="size-5 text-ink-muted" /><span className="flex-1 text-sm">Discount (%)</span>
            <input ref={discountRef} value={discountPct} onChange={(e) => setDiscountPct(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} inputMode="decimal"
              className="h-9 w-20 rounded-lg border border-line bg-white px-2 text-right" placeholder="0" aria-label="Discount percent" />
            <span className="w-20 text-right text-sm">{kes(discount)}</span>
          </label>

          <dl className="space-y-1.5 text-[15px]">
            <div className="flex justify-between"><dt>Subtotal ({units} item{units === 1 ? "" : "s"})</dt><dd>{kes(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Discount</dt><dd>{kes(discount)}</dd></div>
            <div className="flex items-end justify-between pt-1"><dt className="text-xl font-bold">Total</dt>
              <dd className={cx("text-3xl font-extrabold text-brand-600 transition-opacity", allConfirmed ? "" : "opacity-60")}>{kes(total)}</dd></div>
            {store.vat_registered && vat.tax > 0 && <div className="flex justify-between text-sm text-ink-muted"><dt>Includes VAT</dt><dd>{kes(vat.tax)}</dd></div>}
          </dl>
          {(nudges.wholesale || nudges.wholesaleUnlocked.length > 0) && (
            <div className="space-y-1 text-xs" aria-live="polite">
              {nudges.wholesaleUnlocked.length > 0 && (
                <p className="flex items-center gap-1.5 rounded-lg bg-mint-bg px-2.5 py-1.5 font-semibold text-mint-fg"><CheckCircle2 className="size-4" /> Wholesale pricing applied: {nudges.wholesaleUnlocked.join(", ")}</p>
              )}
              {nudges.wholesale && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-bg px-2.5 py-1.5 text-amber-fg"><BadgePercent className="size-4 shrink-0" />
                  <span>Add {nudges.wholesale.more} more {nudges.wholesale.name} for wholesale ({kes(nudges.wholesale.unitPrice)} each{nudges.wholesale.saving > 0 ? `, saves ${kes(nudges.wholesale.saving)}` : ""}).</span></p>
              )}
            </div>
          )}

          <PaymentPanel tenders={tenders} pay={pay} online={online} total={total} hasItems={priced.length > 0}
            onUpdate={updateTender} onAdd={addTender} onRemove={removeTender} />
          {mpesaSent && needsPrompt && (
            <p className="rounded-xl bg-mint-bg p-3 text-sm text-mint-fg">M-Pesa request sent to <strong>{promptTenders.map((t) => maskPhone(t.phone)).join(", ")}</strong> for <strong>{kes(promptAmount)}</strong>. Ask the customer to enter their PIN.</p>
          )}
          {priced.length > 0 && paymentProblem && <p className="text-sm text-amber-fg">{paymentProblem}</p>}
          {error && <p className="rounded-xl bg-rose-bg px-3 py-2 text-sm text-rose-fg" role="alert">{error}</p>}
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            <Button variant="ghost" size="lg" className="border border-line px-4" disabled={!lines.length || pending} onClick={resetSale}><Trash2 className="size-4" /> Clear</Button>
            <Button variant="ghost" size="lg" className="border border-line px-4" disabled={!lines.length || pending || !online} onClick={() => setPanel("suspend")}
              title={online ? "Hold this sale and its stock for 24 hours (F6)" : "Suspending needs a connection"}><PauseCircle className="size-4" /> Suspend</Button>
            <Button size="lg" className="text-base" disabled={!canCharge} onClick={charge}>
              {pending ? "Completing…" : pay.balance > 0 && priced.length ? `${kes(pay.balance)} still to pay`
                : !online ? `Pay ${kes(total)} cash (offline)`
                : needsPrompt && mpesaSent ? "Simulate M-Pesa & Complete" : needsPrompt ? `Send M-Pesa – ${kes(promptAmount)}` : `Pay Now – ${kes(total)}`}
            </Button>
          </div>
          {!allConfirmed && priced.length > 0 && <p className="-mt-2 text-center text-xs text-ink-muted">Confirming prices and stock…</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="border border-line" disabled={!lastReceipt} onClick={() => lastReceipt && setReceipt(lastReceipt)}><Printer className="size-4" /> Reprint Last Receipt</Button>
            <Button variant="ghost" className="border border-line" disabled={!lastReceipt} onClick={() => lastReceipt && setReceipt(lastReceipt)}><Mail className="size-4" /> Resend Last Receipt</Button>
          </div>
        </section>
      </div>

      {panel && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/40 p-4 pt-20" role="dialog" aria-modal="true" onClick={() => setPanel(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{{ suspend: "Suspend Sale", manual: "Manual Product", sync: "Till Connection" }[panel]}</h2>
              <button onClick={() => setPanel(null)} aria-label="Close" className="p-1"><X className="size-5" /></button>
            </div>
            {panel === "suspend" && (
              <div className="space-y-3 text-[15px]">
                <p className="text-ink-muted">
                  The cart{customer ? ` for ${customer.business ?? customer.name}` : ""} is saved and its {units} item{units === 1 ? "" : "s"} are held for <strong className="text-ink">24 hours</strong>.
                  They stay off sale on the website and every till until the sale is paid, released or the time runs out.
                </p>
                <label className="block"><span className="mb-1 block text-sm font-semibold">Note (optional)</span>
                  <input value={suspendNote} onChange={(e) => setSuspendNote(e.target.value)} className={inputClass} placeholder="e.g. Coming back after lunch with cash" maxLength={200} /></label>
                <Button size="lg" className="w-full" onClick={suspend} disabled={pending || !lines.length}>{pending ? "Suspending…" : "Suspend Sale"}</Button>
              </div>
            )}
            {panel === "manual" && <ManualProduct items={items} onAdd={(i, q) => { addItem(i, q); setPanel(null); }} />}
            {panel === "sync" && (
              <div className="space-y-3 text-[15px]">
                <p>{online ? (live === "live" ? "Connected. Stock and prices update live from the shared database." : "Connected. Live updates are reconnecting…") : "Offline. Cash sales are kept on this till and sent automatically when the connection returns."}</p>
                {queue.length > 0 ? (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {queue.map((s) => (
                      <li key={s.clientRef} className="p-3">
                        <div className="flex justify-between gap-2"><span className="font-semibold">{s.customerName ?? "Walk-in"} · {kes(s.chargedTotal)}</span>
                          <Badge tone={s.status === "conflict" ? "rose" : "amber"}>{s.status === "conflict" ? "Needs attention" : "Waiting"}</Badge></div>
                        <p className="text-sm text-ink-muted">{s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} · {formatDateTime(s.offlineAt)}</p>
                        {s.error && <p className="mt-1 text-sm text-rose-fg">{s.error}</p>}
                        {s.status === "conflict" && (
                          <div className="mt-2 flex gap-2">
                            {!s.clientRef.endsWith("-note") && <Button size="sm" variant="secondary" onClick={() => { const next = queue.map((x) => (x.clientRef === s.clientRef ? { ...x, status: "pending" as const, error: undefined } : x)); setQueue(next); saveQueue(next); }}>Retry</Button>}
                            <Button size="sm" variant="ghost" onClick={() => { const next = queue.filter((x) => x.clientRef !== s.clientRef); setQueue(next); saveQueue(next); }}>Mark resolved</Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-ink-muted">Nothing waiting to sync.</p>}
                {online && waiting > 0 && <Button size="sm" onClick={syncNow} disabled={syncing}><RefreshCw className="size-4" /> Sync now</Button>}
              </div>
            )}
          </div>
        </div>
      )}

      {!cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] lg:hidden">
          {(added || error) && <p className={cx("mb-2 rounded-xl px-3 py-1.5 text-sm font-medium", error ? "bg-rose-bg text-rose-fg" : "bg-mint-bg text-mint-fg")} role="status">{error ?? added}</p>}
          <button onClick={() => setCartOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-brand-600 px-4 py-3 text-left text-white">
            <ShoppingCart className="size-6 shrink-0" />
            <span className="flex-1"><span className="block font-bold">{units ? `${units} item${units === 1 ? "" : "s"} · ${kes(total)}` : "Cart is empty"}</span>
              <span className="block text-sm text-white/85">{units ? "Review cart, choose payment and complete the sale" : "Tap Add on a product to start a sale"}</span></span>
            <span className="rounded-full bg-white px-4 py-2 font-bold text-brand-700">{units ? "Pay" : "Open"}</span>
          </button>
        </div>
      )}

      {receipt && <ReceiptDialog receipt={receipt} store={store} onNewSale={newSale} onClose={() => { setLastReceipt(receipt); setReceipt(null); }} />}
    </div>
  );
}

function PaymentPanel({ tenders, pay, online, total, hasItems, onUpdate, onAdd, onRemove }: {
  tenders: Tender[]; pay: ReturnType<typeof settle>; online: boolean; total: number; hasItems: boolean;
  onUpdate: (id: string, patch: Partial<Tender>) => void; onAdd: (m: PosPaymentMethod) => void; onRemove: (id: string) => void;
}) {
  const split = tenders.length > 1;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">Payment</p>
        {!split && online && hasItems && <button onClick={() => onAdd(tenders[0].method === "cash" ? "mpesa" : "cash")} className="text-sm font-semibold text-brand-700">Split payment</button>}
      </div>
      <ul className="space-y-3">
        {tenders.map((t, i) => (
          <li key={t.id} className={cx("space-y-2", split && "rounded-xl border border-line p-3")}>
            {split && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Payment {i + 1}{t.amount === "" && t.method !== "cash" ? " · balance" : ""}</span>
                <span className="flex items-center gap-2"><strong>{kes(pay.amounts[i])}</strong>
                  <button onClick={() => onRemove(t.id)} aria-label={`Remove payment ${i + 1}`} className="text-rose-fg"><X className="size-4" /></button></span>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={`Payment ${i + 1} method`}>
              {METHODS.map(([m, Icon]) => {
                const disabled = !online && m !== "cash";
                return (
                  <button key={m} role="radio" aria-checked={t.method === m} disabled={disabled} onClick={() => onUpdate(t.id, { method: m, reference: "" })}
                    title={disabled ? "Needs a connection" : undefined}
                    className={cx("flex flex-col items-center gap-1 rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", split ? "py-2" : "py-3",
                      t.method === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line hover:border-brand-200")}>
                    <Icon className={split ? "size-5" : "size-6"} strokeWidth={1.7} /> {SHORT_LABEL[m]}
                  </button>
                );
              })}
            </div>
            {(t.method === "cash" || split) && (
              <input value={t.amount} onChange={(e) => onUpdate(t.id, { amount: e.target.value.replace(/[^\d]/g, "") })} className={inputClass} inputMode="numeric"
                placeholder={t.method === "cash" ? "Cash received (KES)" : `Amount (KES), blank = balance ${kes(pay.amounts[i])}`}
                aria-label={t.method === "cash" ? `Cash received, payment ${i + 1}` : `Amount, payment ${i + 1}`} />
            )}
            {t.method === "mpesa" && (
              <div className="grid grid-cols-2 gap-2">
                <input value={t.phone} onChange={(e) => onUpdate(t.id, { phone: e.target.value })} className={inputClass} placeholder="Customer M-Pesa number"
                  inputMode="tel" aria-label="M-Pesa phone" disabled={isMpesaCode(t.reference)} />
                <input value={t.reference} onChange={(e) => onUpdate(t.id, { reference: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) })}
                  className={cx(inputClass, "font-mono")} placeholder="or M-Pesa code" aria-label="M-Pesa code, if the customer already paid" />
              </div>
            )}
            {(t.method === "card" || t.method === "bank_transfer") && (
              <input value={t.reference} onChange={(e) => onUpdate(t.id, { reference: e.target.value.slice(0, 40) })} className={inputClass}
                placeholder={t.method === "card" ? "Card approval code (optional)" : "Bank reference (optional)"} aria-label={`${SHORT_LABEL[t.method]} reference`} />
            )}
          </li>
        ))}
      </ul>
      {hasItems && (split || pay.cash > 0) && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface px-3 py-2.5 text-[15px]">
          <div className="flex justify-between"><span>Paid</span><span>{kes(pay.paid)} of {kes(total)}</span></div>
          {pay.balance > 0 ? <div className="flex justify-between font-bold text-rose-fg"><span>Balance</span><span>{kes(pay.balance)}</span></div>
            : <div className="flex justify-between font-bold"><span>Change</span><span>{kes(pay.change)}</span></div>}
          {pay.balance > 0 && tenders.length < MAX_TENDERS && (
            <div>
              <p className="mb-1.5 text-sm text-ink-muted">Pay the {kes(pay.balance)} balance by:</p>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.filter(([m]) => online || m === "cash").map(([m, Icon]) => (
                  <button key={m} onClick={() => onAdd(m)} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-white py-2 text-xs font-semibold hover:border-brand-200">
                    <Icon className="size-5" strokeWidth={1.7} /> {SHORT_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualProduct({ items, onAdd }: { items: PosItem[]; onAdd: (item: PosItem, qty: number) => void }) {
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("1");
  const hit = items.find((i) => i.sku.toLowerCase() === sku.trim().toLowerCase());
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (hit) onAdd(hit, Math.max(1, Number(qty) || 1)); }}>
      <input autoFocus value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} placeholder="Product code (SKU), e.g. DARLINGSUP-1" aria-label="SKU" />
      <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className={inputClass} inputMode="numeric" aria-label="Quantity" />
      <p className="text-sm text-ink-muted">{sku.trim() ? (hit ? `${hit.name}${hit.variantName ? ` – ${hit.variantName}` : ""} · ${hit.available} in stock` : "No product with this code.") : "Type a product code and quantity."}</p>
      <Button type="submit" disabled={!hit}>Add to sale</Button>
    </form>
  );
}

function ReceiptDialog({ receipt, store, onNewSale, onClose }: { receipt: Receipt; store: StoreSettings; onNewSale: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Receipt">
      <div className="my-auto w-full max-w-sm space-y-4">
        <p className="no-print flex items-center justify-center gap-2 font-semibold text-white">
          {receipt.offline ? <WifiOff className="size-5" /> : <CheckCircle2 className="size-5" />} {receipt.offline ? "Saved on this till" : "Sale complete"}
        </p>
        <ReceiptDocument receipt={receipt} store={store} />
        <div className="no-print space-y-2 rounded-3xl bg-white p-4">
          <ReceiptActions receipt={receipt} store={store} phone={receipt.customerRef?.phone ?? ""} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="border border-line" onClick={onClose}>Close</Button>
            <Button onClick={onNewSale}>New Sale</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
