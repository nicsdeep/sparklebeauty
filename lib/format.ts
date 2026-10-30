import type { StoreSettings } from "@/lib/store-types";

export type Tone = "mint" | "amber" | "rose" | "info" | "teal" | "ai" | "neutral" | "brand";

export type OrderStatus =
  | "pending" | "confirmed" | "paid" | "processing" | "packed" | "dispatched" | "delivered" | "completed"
  | "cancelled" | "refunded" | "ready_for_delivery" | "out_for_delivery";

export type PaymentMethod = "mpesa" | "cash" | "card" | "bank_transfer" | "other";

const TZ = "Africa/Nairobi";

export const kes = (n: number | string | null | undefined) =>
  "KES " + Math.round(Number(n ?? 0)).toLocaleString("en-KE");

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

export const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Start of today in Nairobi, as an ISO string, for "today" queries. */
export function startOfTodayNairobi() {
  const now = new Date();
  const ymd = now.toLocaleDateString("en-CA", { timeZone: TZ });
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "paid", "processing", "packed", "dispatched", "delivered", "completed"];

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "New", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "info" },
  paid: { label: "Paid", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  packed: { label: "Packed", tone: "info" },
  dispatched: { label: "Dispatched", tone: "info" },
  delivered: { label: "Delivered", tone: "teal" },
  completed: { label: "Completed", tone: "teal" },
  cancelled: { label: "Cancelled", tone: "rose" },
  refunded: { label: "Refunded", tone: "rose" },
  ready_for_delivery: { label: "Ready", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
};

/** Button label for moving an order to its next lifecycle step. */
export const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  pending: "Confirm Order",
  confirmed: "Mark as Paid",
  paid: "Start Processing",
  processing: "Mark as Packed",
  packed: "Dispatch Order",
  dispatched: "Mark as Delivered",
  delivered: "Complete Order",
};

export type Channel = "online" | "pos" | "wholesale";

/** Where a sale came from: the website, the shop till, or a wholesale account (any device). */
export const CHANNEL_META: Record<Channel, { label: string; tone: Tone }> = {
  online: { label: "Online", tone: "info" },
  pos: { label: "POS", tone: "brand" },
  wholesale: { label: "Wholesale", tone: "teal" },
};
export const channelMeta = (c: string) => CHANNEL_META[c as Channel] ?? { label: c, tone: "neutral" as Tone };

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "teal" },
  pending: { label: "Awaiting payment", tone: "amber" },
  failed: { label: "Failed", tone: "rose" },
  refunded: { label: "Refunded", tone: "rose" },
  partially_refunded: { label: "Part refunded", tone: "rose" },
};

/** "0712 345 678" -> "0712 XXX XXX" */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `${digits.slice(0, 4)} XXX XXX` : phone;
}

type DeliveryRules = Pick<StoreSettings, "delivery_fee_nairobi" | "delivery_fee_other" | "free_delivery_threshold" | "free_delivery_areas">;

/** Mirrors public.delivery_fee(), which sets the real fee when the order is placed. */
export function deliveryFee(
  method: "delivery" | "pickup",
  address: { city?: string; address_line1?: string; address_line2?: string },
  amountAfterDiscount: number,
  rules: DeliveryRules,
) {
  if (method === "pickup" || amountAfterDiscount === 0 || amountAfterDiscount >= rules.free_delivery_threshold) return 0;
  const where = [address.address_line1, address.address_line2, address.city].filter(Boolean).join(" ").toLowerCase();
  if (rules.free_delivery_areas.some((a) => a.trim() && where.includes(a.trim().toLowerCase()))) return 0;
  return address.city?.trim().toLowerCase() === "nairobi" ? rules.delivery_fee_nairobi : rules.delivery_fee_other;
}
export const POINTS_PER_KES = 100;
