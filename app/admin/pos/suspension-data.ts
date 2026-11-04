import { orderTax } from "@/lib/tax";

// Shared by the Suspended Sales list and detail pages.

export const SUSPENSION_STATUS = {
  active: { label: "Active", tone: "info" },
  completed: { label: "Paid", tone: "mint" },
  released: { label: "Released", tone: "neutral" },
  expired: { label: "Expired", tone: "amber" },
} as const;

export type SuspensionRow = {
  id: string; reference: string; customer_name: string | null; customer_phone: string | null; discount_pct: number; status: keyof typeof SUSPENSION_STATUS;
  expires_at: string; created_at: string; closed_at: string | null; pos_suspension_items: { variant_id: string; quantity: number; unit_price: number }[];
};

/** A suspended sale's total as the till shows it: its items' prices, less the discount, plus VAT. */
export function suspensionTotal(s: Pick<SuspensionRow, "discount_pct" | "pos_suspension_items">, rates: Map<string, number>) {
  const sub = s.pos_suspension_items.reduce((n, i) => n + Number(i.unit_price) * i.quantity, 0);
  return orderTax(s.pos_suspension_items.map((i) => ({ amount: Number(i.unit_price) * i.quantity, rate: rates.get(i.variant_id) ?? 0 })),
    Math.round((sub * Number(s.discount_pct)) / 100)).total;
}
