import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const store = await getStoreSettings();
  return (
    <PolicyPage href="/terms" title="Terms & Conditions" intro={`These terms apply when you use this website or buy from ${store.name}.`}>
      <Section title="About us">
        <p>{store.name} is a beauty shop at {store.address}, Kenya.{store.kra_pin ? ` KRA PIN ${store.kra_pin}.` : ""}</p>
      </Section>
      <Section title="Orders">
        <p>Your order is an offer to buy. It is accepted when we confirm it. We may cancel an order, with a full refund, if an item is out of stock or a price was shown in error, and we will tell you if we do.</p>
      </Section>
      <Section title="Prices and payment">
        <p>Prices are in Kenyan shillings (KES). Delivery charges are shown at checkout before you pay. We accept M-Pesa, Visa and Mastercard cards, and cash on delivery or at the shop where offered.</p>
        {store.vat_registered && <p>Prices include VAT. The VAT is shown on your receipt and tax invoice.</p>}
      </Section>
      <Section title="Products">
        <p>We sell original products from trusted brands. Product photos are a guide; colours can look slightly different on your screen. Always read the label and patch-test new cosmetics and skincare.</p>
      </Section>
      <Section title="Delivery, returns and refunds">
        <p>See our <Link href="/shipping-policy">Shipping Policy</Link> and <Link href="/returns">Return &amp; Refund Policy</Link>.</p>
      </Section>
      <Section title="Accounts and loyalty points">
        <p>Keep your login details private. You are responsible for orders placed from your account. <ToConfirm>Loyalty points have no cash value and may expire or change under the loyalty programme rules.</ToConfirm></p>
      </Section>
      <Section title="Liability">
        <p><ToConfirm>Our liability for any order is limited to the amount you paid for it, except where Kenyan law does not allow this limit.</ToConfirm> Nothing in these terms affects your rights under the Consumer Protection Act, 2012.</p>
      </Section>
      <Section title="Governing law">
        <p>These terms are governed by the laws of Kenya.</p>
      </Section>
      <Section title="Changes">
        <p>We may update these terms. The date at the top shows when they last changed.</p>
      </Section>
    </PolicyPage>
  );
}
