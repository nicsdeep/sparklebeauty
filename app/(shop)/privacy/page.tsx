import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section, ToConfirm } from "@/components/shop/policy-page";
import { getStoreSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const store = await getStoreSettings();
  return (
    <PolicyPage href="/privacy" title="Privacy Policy" intro={`How ${store.name} collects and uses your personal data, in line with Kenya's Data Protection Act, 2019.`}>
      <Section title="What we collect">
        <ul>
          <li>Your name, phone number and email address when you create an account or place an order</li>
          <li>Delivery addresses</li>
          <li>Your orders, payments and loyalty points</li>
          <li>The M-Pesa number you pay from. We don&apos;t store card numbers on this website.</li>
          <li>Reviews you write</li>
        </ul>
      </Section>
      <Section title="How we use it">
        <ul>
          <li>To process, deliver and support your orders</li>
          <li>To contact you about your orders, including by WhatsApp, SMS or phone</li>
          <li>To run your account and loyalty points</li>
          <li>To issue tax invoices and keep the records the law requires</li>
        </ul>
        <p><ToConfirm>We only send you offers if you agree to receive them, and you can opt out at any time.</ToConfirm></p>
      </Section>
      <Section title="Who we share it with">
        <p>Only the service providers we need to run the shop: payment providers, the delivery rider handling your order, our website and database hosting, and the Kenya Revenue Authority for tax invoices. We don&apos;t sell your data.</p>
      </Section>
      <Section title="How long we keep it">
        <p><ToConfirm>We keep order and payment records for as long as tax law requires, and other account data until you ask us to delete your account.</ToConfirm></p>
      </Section>
      <Section title="Your rights">
        <p>You can ask to see, correct or delete your personal data, or object to how we use it. <Link href="/contact">Contact us</Link> to make a request. You can also complain to the Office of the Data Protection Commissioner.</p>
      </Section>
      <Section title="Cookies">
        <p>See our <Link href="/cookies">Cookie Policy</Link>.</p>
      </Section>
    </PolicyPage>
  );
}
