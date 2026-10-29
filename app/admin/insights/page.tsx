import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AiCard, PageHeader } from "@/components/ui";
import { RestockButton } from "@/components/admin/restock-button";
import { loadSales, loadStock } from "@/lib/sales-data";
import { customerInsights, promotionSuggestions, salesInsights, stockInsights, stockSentence } from "@/lib/insights";

export const metadata = { title: "AI Insights" };

export default async function InsightsPage() {
  const [sales, stock] = await Promise.all([loadSales(30), loadStock()]);
  const stockItems = stockInsights(sales, stock).slice(0, 6);
  const customers = customerInsights(sales).slice(0, 4);
  const trends = salesInsights(sales);
  const promos = promotionSuggestions(sales, stock);

  return (
    <div className="space-y-8">
      <PageHeader title="AI Insights" subtitle="Suggestions from your live sales and stock data. Nothing changes until you choose an action." />
      <div className="flex items-start gap-3 rounded-2xl border border-ai-line bg-ai-bg/50 p-4 text-[15px]">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-ai-fg" />
        <p>The assistant looks at the last 30 days of online and in-store sales and current stock. It never changes prices, stock, orders or customer messages by itself.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Stock predictions &amp; restocking</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {stockItems.map((i) => (
            <AiCard key={i.variantId} title={i.daysLeft !== null && i.available > 0 ? "Stock prediction" : "Stock alert"}
              footer={i.restock > 0 && (
                <div className="space-y-2">
                  <p className="text-[15px]"><strong>Recommendation:</strong> consider restocking {i.restock} units of {i.name}.</p>
                  <RestockButton variantId={i.variantId} suggested={i.restock} label={`Record delivery of ${i.restock} units`} tone="ai" />
                </div>
              )}>
              {stockSentence(i)}
            </AiCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sales insights</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {trends.map((t) => <AiCard key={t.title} title={t.title}>{t.sentence}</AiCard>)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Customer insights</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {customers.map((c) => (
            <AiCard key={c.customerId} title="Customer" footer={<Link href={`/admin/customers/${c.customerId}`} className="text-sm font-semibold text-ai-fg">Open {c.name.split(" ")[0]}&apos;s profile →</Link>}>
              {c.sentence} Recommend new arrivals in {c.groups.join(" and ")}.
            </AiCard>
          ))}
        </div>
      </section>

      {promos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Promotion ideas</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {promos.map((p) => <AiCard key={p} title="Promotion">{p}</AiCard>)}
          </div>
        </section>
      )}
    </div>
  );
}
