import { PageHeader } from "@/components/ui";
import { PromotionForm } from "./promotion-form";

export const metadata = { title: "New Promotion" };

export default function NewPromotionPage() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return (
    <div>
      <PageHeader title="Create Promotion" subtitle="A promo code customers enter at checkout." />
      <PromotionForm today={today} />
    </div>
  );
}
