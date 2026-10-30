import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { ButtonLink, Card } from "@/components/ui";
import { deliverySummary } from "@/lib/store-types";
import { getStoreSettings, telHref, whatsappHref } from "@/lib/store";

export const metadata: Metadata = { title: "Contact & delivery" };

export default async function ContactPage() {
  const store = await getStoreSettings();
  const mainPhone = store.phones[0]?.number;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-1 text-ink-muted">We&apos;re happy to help with orders, wig fittings and product advice.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><MapPin className="size-5" /></span>
          <div><p className="font-semibold">Visit the shop</p><p className="text-ink-muted">{store.address}{store.landmark && <><br />{store.landmark}</>}</p></div>
        </Card>
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Clock className="size-5" /></span>
          <div><p className="font-semibold">Opening hours</p><p className="text-ink-muted">{store.hours}</p></div>
        </Card>
        {store.whatsapp && (
          <Card className="flex gap-4 p-5">
            <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><MessageCircle className="size-5" /></span>
            <div>
              <p className="font-semibold">WhatsApp</p>
              <a href={whatsappHref(store.whatsapp)} target="_blank" rel="noopener" className="font-semibold text-ink hover:text-brand-700">{store.whatsapp}</a>
              <p className="text-sm text-ink-muted">Orders, prices and product advice</p>
            </div>
          </Card>
        )}
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Phone className="size-5" /></span>
          <div>
            <p className="font-semibold">Call us</p>
            <ul className="text-ink-muted">
              {store.phones.map((p) => (
                <li key={p.number}><a href={telHref(p.number)} className="font-semibold text-ink hover:text-brand-700">{p.number}</a> · {p.label}</li>
              ))}
            </ul>
          </div>
        </Card>
        {store.email && (
          <Card className="flex gap-4 p-5">
            <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Mail className="size-5" /></span>
            <div><p className="font-semibold">Email</p><a href={`mailto:${store.email}`} className="font-semibold text-ink hover:text-brand-700">{store.email}</a></div>
          </Card>
        )}
        <Card className="flex gap-4 p-5">
          <span className="h-fit rounded-full bg-brand-50 p-3 text-brand-600"><Truck className="size-5" /></span>
          <div><p className="font-semibold">Delivery</p><p className="text-ink-muted">Countrywide delivery: {deliverySummary(store)}. Free pickup at the shop.</p></div>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {store.whatsapp && (
          <ButtonLink href={whatsappHref(store.whatsapp, `Hi ${store.name}, I'd like help with…`)} target="_blank" rel="noopener" size="lg">
            <MessageCircle className="size-5" /> Chat on WhatsApp
          </ButtonLink>
        )}
        {mainPhone && (
          <ButtonLink href={telHref(mainPhone)} size="lg" variant={store.whatsapp ? "secondary" : "primary"}>
            <Phone className="size-5" /> Call {mainPhone}
          </ButtonLink>
        )}
        {store.directions_url && (
          <ButtonLink href={store.directions_url} target="_blank" rel="noopener" size="lg" variant="secondary">
            <MapPin className="size-5" /> Get Directions
          </ButtonLink>
        )}
        {store.facebook_url && <ButtonLink href={store.facebook_url} target="_blank" rel="noopener" size="lg" variant="ghost" className="border border-line">Facebook</ButtonLink>}
        {store.instagram_url && <ButtonLink href={store.instagram_url} target="_blank" rel="noopener" size="lg" variant="ghost" className="border border-line">Instagram</ButtonLink>}
      </div>
      {store.map_embed_url && (
        <section className="mt-8" aria-labelledby="map-title">
          <h2 id="map-title" className="mb-3 text-xl font-semibold">Find us</h2>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line sm:aspect-[16/9]">
            <iframe
              src={store.map_embed_url}
              title={`Map showing ${store.name}, ${store.address}`}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      )}
    </div>
  );
}
