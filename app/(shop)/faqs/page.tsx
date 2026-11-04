import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PolicyPage, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";
import { kes } from "@/lib/format";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsPage() {
  const store = await getStoreSettings();
  const faqs: { q: string; a: React.ReactNode }[] = [
    { q: "Are your products original?", a: <>Yes. We sell original products from trusted brands.</> },
    { q: "How much is delivery?", a: <>{kes(store.delivery_fee_nairobi)} within Nairobi and {kes(store.delivery_fee_other)} to the rest of Kenya. Orders over {kes(store.free_delivery_threshold)} ship free. See <Link href="/delivery">Delivery Information</Link>.</> },
    { q: "How long does delivery take?", a: <ToConfirm>Usually the same or next day in Nairobi, and 1–3 working days elsewhere in Kenya.</ToConfirm> },
    { q: "How can I pay?", a: <>M-Pesa, Visa or Mastercard, or cash on delivery or at the shop where offered.</> },
    { q: "How do I track my order?", a: <>Open your order under <Link href="/account#orders">My orders</Link>, or use the link in your confirmation. It shows each step live, and the rider&apos;s estimated arrival once your order is on the way.</> },
    { q: "Can I collect my order from the shop?", a: <>Yes, choose Pick up in store at checkout. We are at {store.address}{store.landmark ? ` (${store.landmark})` : ""}. {store.hours}.</> },
    { q: "Can I return a wig or hair product?", a: <>Hair that has been worn, cut or styled can&apos;t be returned unless it is faulty. See our <Link href="/returns">Return &amp; Refund Policy</Link>.</> },
    { q: "How do loyalty points work?", a: <>You earn points on purchases made with your account, and can see your balance under <Link href="/account">My account</Link>.</> },
    { q: "How do I contact you?", a: <>Message us on WhatsApp or call; the details are on the <Link href="/contact">contact page</Link>.</> },
  ];
  return (
    <PolicyPage href="/faqs" title="Frequently Asked Questions" intro="Quick answers to what customers ask us most.">
      <div className="divide-y divide-line rounded-xl border border-line bg-white">
        {faqs.map((f) => (
          <details key={f.q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}<ChevronDown className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pb-4 text-ink-muted">{f.a}</div>
          </details>
        ))}
      </div>
    </PolicyPage>
  );
}
