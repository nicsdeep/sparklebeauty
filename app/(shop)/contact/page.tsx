import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = { title: "Contact & delivery" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-1 text-ink-muted">We&apos;re happy to help with orders, wig fittings and product advice.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          { Icon: Phone, title: "Call us", text: "0702 388 724" },
          { Icon: MessageCircle, title: "WhatsApp", text: "0702 388 724" },
          { Icon: Mail, title: "Email", text: "hello@sparklebeauty.co.ke" },
          { Icon: MapPin, title: "Visit the shop", text: "Moi Avenue, Nairobi CBD" },
          { Icon: Clock, title: "Opening hours", text: "Mon–Sat 8:00–20:00 · Sun 10:00–17:00" },
          { Icon: Truck, title: "Delivery", text: "Nairobi same/next day, KES 300 · Rest of Kenya 1–3 days, KES 500 · Free over KES 10,000" },
        ].map(({ Icon, title, text }) => (
          <Card key={title} className="flex gap-4 p-5">
            <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Icon className="size-5" /></span>
            <div><p className="font-semibold">{title}</p><p className="text-ink-muted">{text}</p></div>
          </Card>
        ))}
      </div>
      <ButtonLink href={whatsappLink("0702388724", "Hi Sparkle, I need help with…")!} target="_blank" rel="noopener" size="lg" className="mt-6">
        <MessageCircle className="size-5" /> Chat on WhatsApp
      </ButtonLink>
    </div>
  );
}
