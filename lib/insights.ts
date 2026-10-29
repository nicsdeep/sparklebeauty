import { dayKey, fullName, GROUP_LABEL, stockState, type Sale, type StockRow } from "@/lib/sales-data";

// Rule-based "AI" insights computed from live data. They only suggest; any change
// (restocking, promotions, messages) needs a person to click an action.

export type StockInsight = {
  variantId: string;
  name: string;
  slug: string;
  available: number;
  perDay: number;
  daysLeft: number | null;
  restock: number;
  state: "out" | "low" | "ok";
};

export function stockInsights(sales: Sale[], stock: StockRow[], windowDays = 14): StockInsight[] {
  const since = Date.now() - windowDays * 86400000;
  const sold = new Map<string, number>();
  for (const s of sales) {
    if (new Date(s.created_at).getTime() < since) continue;
    for (const l of s.lines) if (l.variant_id) sold.set(l.variant_id, (sold.get(l.variant_id) ?? 0) + l.quantity);
  }
  return stock
    .map((r) => {
      const perDay = (sold.get(r.variant_id) ?? 0) / windowDays;
      const daysLeft = perDay > 0 ? Math.max(0, Math.floor(r.available / perDay)) : null;
      // Aim for 30 days of cover (or the reorder level plus a buffer for slow movers).
      const target = Math.max(Math.ceil(perDay * 30), r.reorder_level * 2);
      const restock = Math.max(0, Math.ceil((target - r.available) / 5) * 5);
      return { variantId: r.variant_id, name: fullName(r), slug: r.product_slug, available: r.available, perDay, daysLeft, restock, state: stockState(r) };
    })
    .filter((i) => i.state !== "ok" || (i.daysLeft !== null && i.daysLeft <= 14))
    // Predicted run-outs first (soonest first), then out-of-stock items, then other low stock.
    .sort((a, b) => rank(a) - rank(b));
}

export function stockSentence(i: StockInsight) {
  if (i.available <= 0) return `${i.name} is out of stock${i.perDay > 0 ? ` and was selling about ${round1(i.perDay * 7)} a week` : ""}.`;
  if (i.daysLeft !== null && i.daysLeft <= 30) return `${i.name} may run out in ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"} (${i.available} left, selling about ${round1(i.perDay * 7)} a week).`;
  return `${i.name} is low on stock (${i.available} left).`;
}

export type CustomerInsight = { customerId: string; name: string; groups: string[]; orders: number; spend: number; sentence: string };

export function customerInsights(sales: Sale[]): CustomerInsight[] {
  const byCustomer = new Map<string, { name: string; orders: number; spend: number; groups: Map<string, number> }>();
  for (const s of sales) {
    if (!s.customer_id || s.tier === "wholesale") continue;
    const c = byCustomer.get(s.customer_id) ?? { name: s.customer_name ?? "Customer", orders: 0, spend: 0, groups: new Map() };
    c.orders += 1;
    c.spend += s.total;
    for (const l of s.lines) c.groups.set(l.group, (c.groups.get(l.group) ?? 0) + l.quantity);
    byCustomer.set(s.customer_id, c);
  }
  return [...byCustomer.entries()]
    .filter(([, c]) => c.orders >= 2)
    .map(([customerId, c]) => {
      const groups = [...c.groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => (GROUP_LABEL[g] ?? g).toLowerCase());
      const first = c.name.split(" ")[0];
      return { customerId, name: c.name, groups, orders: c.orders, spend: c.spend,
        sentence: `${first} frequently buys ${groups.join(" and ")} products (${c.orders} orders).` };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function customerSentence(sales: Sale[], customerId: string) {
  return customerInsights(sales).find((c) => c.customerId === customerId)?.sentence ?? null;
}

export type SalesInsight = { title: string; sentence: string };

export function salesInsights(sales: Sale[]): SalesInsight[] {
  const out: SalesInsight[] = [];

  // Weekend vs weekday sales of hair, per day.
  const days = new Map<string, { weekend: boolean; hair: number }>();
  for (const s of sales) {
    const k = dayKey(s.created_at);
    const dow = new Date(`${k}T12:00:00+03:00`).getDay();
    const d = days.get(k) ?? { weekend: dow === 0 || dow === 6, hair: 0 };
    d.hair += s.lines.filter((l) => l.group === "hair").reduce((t, l) => t + l.quantity, 0);
    days.set(k, d);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const we = avg([...days.values()].filter((d) => d.weekend).map((d) => d.hair));
  const wd = avg([...days.values()].filter((d) => !d.weekend).map((d) => d.hair));
  if (we > 0 && wd > 0) {
    const pct = Math.round((we / wd - 1) * 100);
    out.push({
      title: "Weekly pattern",
      sentence: pct >= 0
        ? `Hair products are selling ${pct}% faster on weekends. Consider extra stylist cover on Saturdays.`
        : `Hair products are selling ${-pct}% faster on weekdays than weekends.`,
    });
  }

  // Category momentum: last 7 days vs the 7 before.
  const week = (from: number, to: number) => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const age = (Date.now() - new Date(s.created_at).getTime()) / 86400000;
      if (age < from || age >= to) continue;
      for (const l of s.lines) m.set(l.group, (m.get(l.group) ?? 0) + l.line_total);
    }
    return m;
  };
  const thisWeek = week(0, 7);
  const lastWeek = week(7, 14);
  const growth = [...thisWeek.entries()]
    .filter(([g]) => (lastWeek.get(g) ?? 0) > 0)
    .map(([g, v]) => ({ g, pct: Math.round((v / lastWeek.get(g)! - 1) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];
  if (growth && growth.pct > 0) {
    out.push({ title: "Trending category", sentence: `${GROUP_LABEL[growth.g] ?? growth.g} sales are up ${growth.pct}% compared with the previous week.` });
  }

  // Channel mix.
  const online = sales.filter((s) => s.channel === "online").reduce((t, s) => t + s.total, 0);
  const total = sales.reduce((t, s) => t + s.total, 0);
  if (total > 0) {
    out.push({ title: "Channel mix", sentence: `Online orders bring in ${Math.round((online / total) * 100)}% of revenue; the shop brings in ${Math.round(((total - online) / total) * 100)}%.` });
  }
  return out;
}

export function promotionSuggestions(sales: Sale[], stock: StockRow[]) {
  const soldProducts = new Set(sales.flatMap((s) => s.lines.map((l) => l.product_id)));
  const byProduct = new Map<string, { name: string; available: number }>();
  for (const r of stock) {
    const p = byProduct.get(r.product_id) ?? { name: r.product_name, available: 0 };
    p.available += r.available;
    byProduct.set(r.product_id, p);
  }
  return [...byProduct.entries()]
    .filter(([id, p]) => !soldProducts.has(id) && p.available >= 30)
    .sort((a, b) => b[1].available - a[1].available)
    .slice(0, 3)
    .map(([, p]) => `${p.name} has ${p.available} in stock and no sales in 30 days. Consider featuring it in a promotion.`);
}

const rank = (i: StockInsight) => (i.available > 0 && i.daysLeft !== null && i.daysLeft <= 30 ? i.daysLeft : i.state === "out" ? 1000 : 2000 + i.available);

const round1 = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
