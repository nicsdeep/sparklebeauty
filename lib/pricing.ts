// Prices come from the database pricing engine (price_breaks / quote_cart / pos_quote), which
// applies, in order: a negotiated customer price, the customer's wholesale tier, the 10+ unit
// wholesale price, then retail. Screens never decide a price: they receive the server's price
// breaks for a product and read off the one for the quantity (instant feedback, and the POS can
// keep selling offline), then the server quote or the order itself confirms the final price.

export type PriceRule = "negotiated" | "customer_tier" | "quantity" | "retail";
export type PriceBreak = { min_qty: number; unit_price: number; rule: PriceRule };
export type QuoteLine = {
  variant_id: string;
  quantity: number;
  unit_price: number;
  retail_price: number;
  rule: PriceRule;
  line_total: number;
  available: number;
  breaks: PriceBreak[];
  /** VAT rate in percent for this line (0 when exempt, zero-rated or non-VAT). */
  tax_rate: number;
};

/** The server-resolved break that applies at this quantity (highest min_qty not above it). */
export function breakFor(breaks: PriceBreak[] | undefined, quantity: number): PriceBreak | null {
  if (!breaks?.length) return null;
  return [...breaks].sort((a, b) => b.min_qty - a.min_qty).find((b) => b.min_qty <= quantity) ?? null;
}

/** The quantity break above the current one, e.g. "10+ for KES 500 each". */
export const nextBreak = (breaks: PriceBreak[] | undefined, quantity: number) =>
  (breaks ?? []).filter((b) => b.min_qty > quantity).sort((a, b) => a.min_qty - b.min_qty)[0] ?? null;

/** Short label for why a price applies (shown next to cart lines). */
export function ruleLabel(rule: PriceRule, minQty?: number) {
  switch (rule) {
    case "negotiated": return "Special customer price";
    case "customer_tier": return "Wholesale customer price";
    case "quantity": return `Wholesale pricing applied — ${minQty ?? 10}+ units`;
    default: return null;
  }
}

/** Normalises a quote row from Postgres (numerics arrive as strings). */
export const toQuoteLine = (r: Record<string, unknown>): QuoteLine => ({
  variant_id: r.variant_id as string,
  quantity: Number(r.quantity),
  unit_price: Number(r.unit_price),
  retail_price: Number(r.retail_price),
  rule: r.rule as PriceRule,
  line_total: Number(r.line_total),
  available: Number(r.available),
  breaks: ((r.breaks as { min_qty: number; unit_price: number | string; rule: PriceRule }[] | null) ?? [])
    .map((b) => ({ min_qty: Number(b.min_qty), unit_price: Number(b.unit_price), rule: b.rule })),
  tax_rate: Number(r.tax_rate ?? 0),
});
