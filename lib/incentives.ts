import { breakFor, nextBreak, type PriceBreak } from "@/lib/pricing";
import { deliveryFee, type DeliveryRules } from "@/lib/format";

// Shopping incentives, one rule for the website cart, checkout and POS (Nicholas, 2026-11-04):
//  - Wholesale is per product: the pricing engine's quantity break (10+ units of that product).
//    The cart total never triggers wholesale. Nudges come from the server's own price breaks,
//    so a saving is only shown when the engine really has a cheaper price for more units.
//  - Free delivery is the cart-value threshold in Settings (free_delivery_threshold), worked out
//    by deliveryFee(), the same rule the database uses when the order is placed.
// Screens only display what this returns.

/** available: units in stock (null when not known yet); a nudge never asks for more than that. */
export type IncentiveLine = { name: string; quantity: number; breaks: PriceBreak[] | undefined; available?: number | null };

export type WholesaleNudge = {
  name: string;
  /** Units to add to reach the wholesale break. */
  more: number;
  minQty: number;
  /** Wholesale unit price at the break. */
  unitPrice: number;
  /** What the whole line saves at the break, versus buying that many at today's price. */
  saving: number;
};

export type Incentives = {
  /** The product closest to its wholesale break (at least halfway there), if any. */
  wholesale: WholesaleNudge | null;
  /** Products already at their wholesale (quantity) price. */
  wholesaleUnlocked: string[];
  /** Free delivery: null when it doesn't apply (pickup, the POS, or an empty cart). */
  delivery: { remaining: number; unlocked: boolean; progress: number; where: string | null } | null;
};

export function incentives(
  lines: IncentiveLine[],
  delivery?: { method: "delivery" | "pickup"; address: { city?: string; address_line1?: string; address_line2?: string }; amountAfterDiscount: number; rules: DeliveryRules },
): Incentives {
  let wholesale: WholesaleNudge | null = null;
  const wholesaleUnlocked: string[] = [];
  for (const l of lines) {
    const now = breakFor(l.breaks, l.quantity);
    if (now?.rule === "quantity") { wholesaleUnlocked.push(l.name); continue; }
    const next = nextBreak(l.breaks, l.quantity);
    if (!now || !next || next.rule !== "quantity" || next.unit_price >= now.unit_price) continue;
    const more = next.min_qty - l.quantity;
    // Only nudge when the customer is at least halfway: "add 9 more wigs" isn't helpful.
    if (l.quantity * 2 < next.min_qty) continue;
    if (l.available != null && next.min_qty > l.available) continue;
    if (!wholesale || more < wholesale.more) {
      wholesale = { name: l.name, more, minQty: next.min_qty, unitPrice: next.unit_price, saving: (now.unit_price - next.unit_price) * next.min_qty };
    }
  }

  let free: Incentives["delivery"] = null;
  if (delivery && delivery.method === "delivery" && delivery.amountAfterDiscount > 0) {
    const threshold = delivery.rules.free_delivery_threshold;
    const unlocked = deliveryFee("delivery", delivery.address, delivery.amountAfterDiscount, delivery.rules) === 0;
    const city = delivery.address.city?.trim();
    free = {
      remaining: unlocked ? 0 : Math.max(0, Math.ceil(threshold - delivery.amountAfterDiscount)),
      unlocked,
      progress: unlocked ? 1 : Math.min(1, delivery.amountAfterDiscount / threshold),
      where: city ? city.charAt(0).toUpperCase() + city.slice(1) : null,
    };
  }
  return { wholesale, wholesaleUnlocked, delivery: free };
}
