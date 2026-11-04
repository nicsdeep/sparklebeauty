import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";
import { kes } from "@/lib/format";

export const metadata: Metadata = { title: "Delivery Information" };

export default async function DeliveryPage() {
  const store = await getStoreSettings();
  const areas = store.free_delivery_areas.filter((a) => a.trim());
  return (
    <PolicyPage href="/delivery" title="Delivery Information" intro="How we get your order to you, what it costs, and how to follow it on the way.">
      <Section title="Delivery fees">
        <ul>
          <li>Within Nairobi: <strong>{store.delivery_fee_nairobi ? kes(store.delivery_fee_nairobi) : "free"}</strong></li>
          <li>Rest of Kenya: <strong>{store.delivery_fee_other ? kes(store.delivery_fee_other) : "free"}</strong></li>
          <li>Free delivery on orders over <strong>{kes(store.free_delivery_threshold)}</strong></li>
          {areas.length > 0 && <li>Free delivery to <strong>{areas.join(", ")}</strong></li>}
          <li>Pick up in store: <strong>free</strong></li>
        </ul>
        <p>The exact fee for your address is shown at checkout before you pay.</p>
      </Section>
      <Section title="Delivery times">
        <p><ToConfirm>Orders within Nairobi are usually delivered the same or next day; orders to the rest of Kenya usually take 1–3 working days.</ToConfirm></p>
        <p>Once a rider is assigned, your order page shows an estimated arrival time.</p>
      </Section>
      <Section title="Pick up in store">
        <p>Choose <strong>Pick up in store</strong> at checkout and collect from {store.address}{store.landmark ? ` (${store.landmark})` : ""}. {store.hours}.</p>
        <p>We&apos;ll let you know when your order is ready to collect.</p>
      </Section>
      <Section title="Tracking your order">
        <p>Every order has its own page with live status updates: confirmed, packed, out for delivery and delivered. Find it under <Link href="/account#orders">My orders</Link> or open the link in your order confirmation.</p>
      </Section>
      <Section title="Questions">
        <p>See the <Link href="/shipping-policy">Shipping Policy</Link> for the full terms, or <Link href="/contact">contact us</Link> on WhatsApp.</p>
      </Section>
    </PolicyPage>
  );
}
