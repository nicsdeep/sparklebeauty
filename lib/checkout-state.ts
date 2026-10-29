"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/format";

/** Everything the shopper has entered during checkout. Kept in sessionStorage so Back/Next never loses it. */
export type CheckoutState = {
  promoCode?: string;
  discount?: number;
  promoLabel?: string;
  contact?: { full_name: string; phone: string; email: string };
  delivery?: { method: "delivery" | "pickup"; address_line1: string; address_line2: string; city: string; county: string; notes: string; save: boolean };
  paymentMethod?: PaymentMethod;
  mpesaPhone?: string;
  /** Set once the order is placed, so going back never creates a duplicate order. */
  placed?: { orderId: string; orderNumber: string; total: number; paid: boolean; reference?: string };
};

const KEY = "sparkle-checkout-v1";
const EVENT = "sparkle-checkout-change";

function read(): CheckoutState {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useCheckoutState(): [CheckoutState, (patch: Partial<CheckoutState>) => void, () => void, boolean] {
  const [state, setState] = useState<CheckoutState>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(read());
    setLoaded(true);
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const update = useCallback((patch: Partial<CheckoutState>) => {
    const next = { ...read(), ...patch };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: state still lives in memory for this page.
    }
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    setState({});
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [state, update, reset, loaded];
}
