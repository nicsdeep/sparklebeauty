import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Return & Refund Policy" };

export default async function ReturnsPage() {
  const store = await getStoreSettings();
  return (
    <PolicyPage href="/returns" title="Return & Refund Policy" intro="We want you to love what you buy. If something isn't right, here is how we put it right.">
      <Section title="Wrong, damaged or faulty items">
        <p>If you receive the wrong item, or an item that is damaged or faulty, contact us with your order number and a photo. We will replace it or refund you.</p>
        <p><ToConfirm>Please report it within 48 hours of delivery or collection.</ToConfirm></p>
      </Section>
      <Section title="Changing your mind">
        <p><ToConfirm>Unopened items in their original packaging can be returned within 7 days for an exchange or store credit.</ToConfirm></p>
      </Section>
      <Section title="Items we can't take back">
        <p>For hygiene reasons some items cannot be returned once opened or used, unless they are faulty:</p>
        <ul>
          <li><ToConfirm>Wigs, hair extensions and hair pieces that have been worn, cut, styled or had the lace altered</ToConfirm></li>
          <li><ToConfirm>Opened cosmetics, skincare and perfumes</ToConfirm></li>
          <li><ToConfirm>Items bought on clearance</ToConfirm></li>
        </ul>
      </Section>
      <Section title="How to return an item">
        <ul>
          <li><Link href="/contact">Contact us</Link> with your order number and the reason for the return.</li>
          <li>Bring or send the item to our shop at {store.address}, with its packaging and receipt.</li>
          <li>We check the item and confirm the outcome with you.</li>
        </ul>
      </Section>
      <Section title="Refunds">
        <p>Approved refunds are paid back to the method you used: M-Pesa refunds to the paying number, card refunds to the same card, cash purchases in cash or store credit.</p>
        <p><ToConfirm>Refunds are processed within 7 working days of approval. Delivery charges are refunded only when the item was wrong, damaged or faulty.</ToConfirm></p>
      </Section>
    </PolicyPage>
  );
}
