"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { quoteCart } from "@/app/(shop)/actions";
import { useLiveTopic } from "@/lib/live";
import { breakFor, type PriceRule, type QuoteLine } from "@/lib/pricing";
import { orderTax, STANDARD_VAT, type OrderTax } from "@/lib/tax";

export type CartItem = {
  variantId: string;
  slug: string;
  name: string;
  variantName: string | null;
  category: string;
  brand: string | null;
  image?: string | null;
  /** Retail price when added; only shown until the server quote arrives. */
  price: number;
  quantity: number;
};

/** What the pricing engine says about a cart line. */
/** taxRate: VAT % for the line from the server quote (16, the standard rate, until the quote arrives). */
export type LinePrice = { unit: number; retail: number; rule: PriceRule; minQty: number; available: number | null; confirmed: boolean; taxRate: number };

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  /** Sum of engine-priced lines (instant from the server's price breaks, then confirmed). */
  subtotal: number;
  /** True while the server is confirming the latest prices and stock. */
  pricing: boolean;
  priceOf: (item: CartItem) => LinePrice;
  /** VAT and total for this cart with a discount and delivery fee (same rule as the order). */
  taxFor: (discount: number, delivery: number, vatRegistered: boolean) => OrderTax;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "sparkle-cart-v1";
export const MAX_LINE_QTY = 500;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, QuoteLine>>({});
  const [pricing, setPricing] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {
      // Storage unavailable: start with an empty cart.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors; the cart still works for this visit.
    }
  }, [items, ready]);

  // Confirm prices and stock with the server whenever the cart changes (newest request wins).
  const requote = useCallback(async (lines: CartItem[]) => {
    const id = ++request.current;
    if (!lines.length) { setQuotes({}); setPricing(false); return; }
    setPricing(true);
    try {
      const rows = await quoteCart(lines.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })));
      if (id === request.current) setQuotes(Object.fromEntries(rows.map((r) => [r.variant_id, r])));
    } catch {
      // Offline or server error: keep the last confirmed prices; checkout re-prices anyway.
    } finally {
      if (id === request.current) setPricing(false);
    }
  }, []);
  const key = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => requote(items), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Another channel sold or restocked something in this cart: re-read prices and availability.
  const inCart = useRef(new Set<string>());
  inCart.current = new Set(items.map((i) => i.variantId));
  const latest = useRef(items);
  latest.current = items;
  useLiveTopic("catalog", (event, payload) => {
    if (event === "catalog" || inCart.current.has(String(payload.variant_id))) requote(latest.current);
  });

  const priceOf = useCallback((item: CartItem): LinePrice => {
    const q = quotes[item.variantId];
    if (!q) return { unit: item.price, retail: item.price, rule: "retail", minQty: 1, available: null, confirmed: false, taxRate: 16 };
    const b = breakFor(q.breaks, item.quantity);
    const confirmed = q.quantity === item.quantity;
    return {
      unit: confirmed ? q.unit_price : b?.unit_price ?? q.unit_price,
      retail: q.retail_price,
      rule: confirmed ? q.rule : b?.rule ?? q.rule,
      minQty: (confirmed ? breakFor(q.breaks, q.quantity) : b)?.min_qty ?? 1,
      available: q.available,
      confirmed,
      taxRate: q.tax_rate,
    };
  }, [quotes]);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) return prev.map((i) => (i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(MAX_LINE_QTY, i.quantity + quantity) } : i));
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(MAX_LINE_QTY, quantity)) } : i)));
  }, []);

  const remove = useCallback((variantId: string) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      ready,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + priceOf(i).unit * i.quantity, 0),
      pricing,
      priceOf,
      taxFor: (discount: number, delivery: number, vatRegistered: boolean) =>
        orderTax(items.map((i) => ({ amount: priceOf(i).unit * i.quantity, rate: priceOf(i).taxRate })), discount, delivery, vatRegistered ? STANDARD_VAT : 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, ready, pricing, priceOf, add, setQuantity, remove, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
