// Store settings types and link helpers, safe to import from client components.

export type StorePhone = { label: string; number: string };

export type StoreSettings = {
  name: string;
  address: string;
  landmark: string | null;
  hours: string;
  phones: StorePhone[];
  /** WhatsApp contacts customers can message (e.g. Support, Sales); the first is the main one. */
  whatsapp_contacts: StorePhone[];
  email: string | null;
  map_embed_url: string | null;
  directions_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  delivery_fee_nairobi: number;
  delivery_fee_other: number;
  free_delivery_threshold: number;
  free_delivery_areas: string[];
  /** Shop's KRA PIN, printed on tax invoices. */
  kra_pin: string | null;
  /** VAT registered: VAT is added on top of prices (they are VAT-exclusive). */
  vat_registered: boolean;
};

const ksh = (n: number) => "KES " + Math.round(n).toLocaleString("en-KE");

/** e.g. "Nairobi KES 300 · rest of Kenya KES 500 · free over KES 10,000 · free to Nairobi CBD" */
export function deliverySummary(s: Pick<StoreSettings, "delivery_fee_nairobi" | "delivery_fee_other" | "free_delivery_threshold" | "free_delivery_areas">) {
  const parts = [
    `Nairobi ${s.delivery_fee_nairobi ? ksh(s.delivery_fee_nairobi) : "free"}`,
    `rest of Kenya ${s.delivery_fee_other ? ksh(s.delivery_fee_other) : "free"}`,
    `free over ${ksh(s.free_delivery_threshold)}`,
  ];
  const areas = s.free_delivery_areas.filter((a) => a.trim());
  if (areas.length) parts.push(`free to ${areas.join(", ")}`);
  return parts.join(" · ");
}

export const telHref =(phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** wa.me link; accepts 07xx…, 2547xx… or +2547xx… */
/** The main WhatsApp number: the first contact, shown on invoices, the contact page and the footer. */
export const mainWhatsapp = (s: Pick<StoreSettings, "whatsapp_contacts">) => s.whatsapp_contacts[0]?.number ?? null;

export function whatsappHref(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `254${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
