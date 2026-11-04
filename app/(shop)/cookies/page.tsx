import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, Section } from "@/components/shop/policy-page";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <PolicyPage href="/cookies" title="Cookie Policy" intro="What this website stores in your browser, and why.">
      <Section title="What we use">
        <p>We only use what the shop needs to work. We don&apos;t use advertising or tracking cookies.</p>
        <ul>
          <li><strong>Sign-in cookies</strong> keep you logged in to your account while you shop.</li>
          <li><strong>Your cart</strong> is saved in your browser&apos;s local storage, so items stay in your cart if you leave and come back.</li>
        </ul>
      </Section>
      <Section title="Managing them">
        <p>You can clear cookies and site data in your browser settings. If you do, you will be signed out and your cart will be emptied.</p>
      </Section>
      <Section title="Changes">
        <p>If we add other cookies, such as for analytics, we will update this page first. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
      </Section>
    </PolicyPage>
  );
}
