// VAT, worked out exactly as the database does it (public.apply_order_tax), so what the till and
// checkout show is to the cent what the order and the KRA tax invoice will say. Prices include VAT
// (Nicholas, 2026-11-11): the customer pays the shelf price, and the VAT inside it is worked out
// as amount × rate ÷ (100 + rate). Amounts are handled in whole cents to avoid float drift.

export type TaxType = "A" | "B" | "C" | "D" | "E";

/** KRA eTIMS tax types. Rates come from the server (tax_rate / variant_tax_rates). */
export const TAX_TYPES: Record<TaxType, string> = {
  A: "Exempt",
  B: "VAT 16%",
  C: "Zero-rated",
  D: "Non-VAT",
  E: "VAT 8%",
};

/** Delivery is standard-rated (eTIMS type B) when the shop is VAT registered. */
export const STANDARD_VAT = 16;

const cents = (n: number) => BigInt(Math.round(n * 100));
/** a / b rounded half up, for non-negative integers (Postgres round() on numeric). */
const roundDiv = (a: bigint, b: bigint) => (b === 0n ? 0n : (2n * a + b) / (2n * b));
const toNum = (c: bigint) => Number(c) / 100;

/** discount: share of the order discount; taxable: amount less the VAT inside it; tax: the VAT inside it. */
export type TaxedLine = { discount: number; taxable: number; tax: number };
export type OrderTax = { lines: TaxedLine[]; discount: number; tax: number; deliveryTax: number; total: number };

/**
 * lines: each line's amount as the customer pays it (VAT-inclusive unit price × quantity) and its VAT rate in percent.
 * discount: order discount, spread over the lines in proportion to their amount.
 * Delivery is standard-rated (deliveryRate, 16% when VAT registered); its VAT is also inside the fee.
 * total = lines less discount + delivery. tax = the VAT contained in that total.
 */
export function orderTax(lines: { amount: number; rate: number }[], discount = 0, delivery = 0, deliveryRate = 0): OrderTax {
  const sub = lines.reduce((s, l) => s + cents(l.amount), 0n);
  const disc = cents(discount);
  const taxed = lines.map((l) => {
    const amount = cents(l.amount);
    const d = sub > 0n ? roundDiv(amount * disc, sub) : 0n;
    const rate = BigInt(Math.round(l.rate * 100));
    const tax = roundDiv((amount - d) * rate, 10000n + rate);
    return { d, taxable: amount - d - tax, gross: amount - d, tax };
  });
  const fee = cents(delivery);
  const feeRate = BigInt(Math.round(deliveryRate * 100));
  const feeTax = roundDiv(fee * feeRate, 10000n + feeRate);
  const lineTax = taxed.reduce((s, t) => s + t.tax, 0n);
  return {
    lines: taxed.map((t) => ({ discount: toNum(t.d), taxable: toNum(t.taxable), tax: toNum(t.tax) })),
    discount: toNum(taxed.reduce((s, t) => s + t.d, 0n)),
    tax: toNum(lineTax + feeTax),
    deliveryTax: toNum(feeTax),
    total: toNum(taxed.reduce((s, t) => s + t.gross, 0n) + fee),
  };
}

/** KRA PIN: A (individual) or P (company), 9 digits, a letter. Same check as the database. */
export const KRA_PIN = /^[AP]\d{9}[A-Z]$/;
