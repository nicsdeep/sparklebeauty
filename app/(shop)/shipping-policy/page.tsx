import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";
import { kes } from "@/lib/format";

export const metadata: Metadata = { title: "Shipping Policy" };

export default async function ShippingPolicyPage() {
  const store = await getStoreSettings();
  const areas = store.free_delivery_areas.filter((a) => a.trim());
  return (
    <PolicyPage href="/shipping-policy" title="Shipping Policy" intro={`How ${store.name} delivers orders placed on this website.`}>
      <Section title="Where we deliver">
        <p>We deliver across Kenya, and you can also collect your order from our shop at {store.address}.</p>
      </Section>
      <Section title="Shipping charges">
        <ul>
          <li>Nairobi: {kes(store.delivery_fee_nairobi)}</li>
          <li>Rest of Kenya: {kes(store.delivery_fee_other)}</li>
          <li>Orders over {kes(store.free_delivery_threshold)} ship free.</li>
          {areas.length > 0 && <li>Delivery to {areas.join(", ")} is free.</li>}
        </ul>
        <p>The shipping charge is shown at checkout and included in your order total before you pay. Prices are in Kenyan shillings (KES).</p>
      </Section>
      <Section title="Processing and delivery times">
        <p>We start preparing your order once it is confirmed: paid by M-Pesa or card, or confirmed for cash on delivery.</p>
        <p><ToConfirm>Orders confirmed before 5:00 pm are usually dispatched the same day. Nairobi deliveries usually arrive the same or next day; other towns usually take 1–3 working days.</ToConfirm></p>
        <p>These are estimates, not guarantees. Your order page shows the live status and, once a rider is on the way, an estimated arrival time.</p>
      </Section>
      <Section title="Receiving your order">
        <ul>
          <li>Please give a correct address and a phone number we can reach; the rider will call when nearby.</li>
          <li>Check your parcel when it arrives and tell us straight away if anything is missing or damaged.</li>
          <li><ToConfirm>If a delivery fails because nobody is available, we will contact you to rearrange it; a second delivery may be charged.</ToConfirm></li>
        </ul>
      </Section>
      <Section title="Cash on delivery">
        <p>Where cash on delivery is offered at checkout, please have the exact amount ready. For pickup orders you can pay at the shop.</p>
      </Section>
      <Section title="Contact">
        <p>For anything about a delivery, <Link href="/contact">contact us</Link> with your order number. See also <Link href="/delivery">Delivery Information</Link> and our <Link href="/returns">Return &amp; Refund Policy</Link>.</p>
      </Section>
    </PolicyPage>
  );
}
