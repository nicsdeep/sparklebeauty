import type { Metadata } from "next";
import { Clock, MapPin, Phone, Truck } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";
import { MAIN_PHONE, STORE, telHref } from "@/lib/store";

export const metadata: Metadata = { title: "Contact & delivery" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-1 text-ink-muted">We&apos;re happy to help with orders, wig fittings and product advice.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><MapPin className="size-5" /></span>
          <div><p className="font-semibold">Visit the shop</p><p className="text-ink-muted">{STORE.address}<br />{STORE.landmark}</p></div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Clock className="size-5" /></span>
          <div><p className="font-semibold">Opening hours</p><p className="text-ink-muted">{STORE.hours}</p></div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Phone className="size-5" /></span>
          <div>
            <p className="font-semibold">Call us</p>
            <ul className="text-ink-muted">
              {STORE.phones.map((p) => (
                <li key={p.number}><a href={telHref(p.number)} className="font-semibold text-ink hover:text-brand-700">{p.number}</a> · {p.label}</li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Truck className="size-5" /></span>
          <div><p className="font-semibold">Delivery</p><p className="text-ink-muted">Nairobi same or next day, KES 300 · Rest of Kenya 1–3 days, KES 500 · Free over KES 10,000 · Free pickup at the shop</p></div>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={telHref(MAIN_PHONE)} size="lg">
          <Phone className="size-5" /> Call {MAIN_PHONE}
        </ButtonLink>
        <ButtonLink href={STORE.directionsUrl} target="_blank" rel="noopener" size="lg" variant="secondary">
          <MapPin className="size-5" /> Get Directions
        </ButtonLink>
      </div>
      <section className="mt-8" aria-labelledby="map-title">
        <h2 id="map-title" className="mb-3 text-xl font-semibold">Find us in Pipeline</h2>
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line sm:aspect-[16/9]">
          <iframe
            src={STORE.mapEmbedUrl}
            title={`Map showing ${STORE.name}, ${STORE.address}`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}
