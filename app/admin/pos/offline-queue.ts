// Offline till sales waiting to reach the server. They live only in this browser until synced.
// Each has a unique clientRef, so pos_complete_sale records it at most once even if a sync is
// retried after a dropped connection. The server re-checks stock and prices when it syncs;
// a sale that no longer fits the stock is kept here as a "conflict" for a manager to resolve,
// never forced through.

export type QueuedSale = {
  clientRef: string;
  offlineAt: string;
  customerId: string | null;
  customerName: string | null;
  items: { variant_id: string; quantity: number; name: string }[];
  discount: number;
  amountTendered: number;
  /** What the customer was charged at the till (from the server's price breaks). */
  chargedTotal: number;
  status: "pending" | "conflict";
  error?: string;
};

const KEY = "sparkle-pos-offline-v1";

export function loadQueue(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedSale[];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedSale[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked: the queue still lives in memory for this session.
  }
}

/** A random, collision-safe reference for one sale. */
export const newClientRef = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Parked (suspended) sales: a cart put aside to serve another customer.
export type ParkedSale = { id: string; at: string; customerId: string | null; customerName: string | null; lines: { variantId: string; qty: number }[]; discountPct: string };
const PARK_KEY = "sparkle-pos-parked-v1";

export function loadParked(): ParkedSale[] {
  try {
    return JSON.parse(localStorage.getItem(PARK_KEY) ?? "[]") as ParkedSale[];
  } catch {
    return [];
  }
}

export function saveParked(list: ParkedSale[]) {
  try {
    localStorage.setItem(PARK_KEY, JSON.stringify(list));
  } catch {
    // Ignore: parking is a convenience.
  }
}
