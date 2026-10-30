import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { StoreSettings } from "@/lib/store-types";

export type { StoreSettings, StorePhone } from "@/lib/store-types";
export { telHref, whatsappHref } from "@/lib/store-types";

// Used only if the store_settings row can't be read (e.g. before its migration is applied).
const FALLBACK: StoreSettings = {
  name: "Sparkle Beauty & Cosmetics",
  address: "Kware, Pipeline, Nairobi",
  landmark: "Near Redeemed Gospel Church and King Worship Centre",
  hours: "Open daily, 7:00 am – 8:00 pm",
  phones: [
    { label: "Shop 1", number: "0799 912 191" },
    { label: "Shop 2", number: "0797 468 963" },
    { label: "Shop 2", number: "0719 707 857" },
  ],
  whatsapp: "+254 727 939 626",
  email: null,
  map_embed_url:
    "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d510575.2266188962!2d36.8737081!3d-1.24993!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f12353c84667f%3A0xcf5304b1a32e7a1e!2sSparkle%20Beauty%20%26%20Cosmetics!5e0!3m2!1sen!2ske!4v1793312220120!5m2!1sen!2ske",
  directions_url: "https://www.google.com/maps/search/?api=1&query=Sparkle+Beauty+and+Cosmetics+Pipeline+Nairobi",
  facebook_url: "https://www.facebook.com/Sparklebeautyandcosmetics",
  instagram_url: "https://www.instagram.com/sparkle_beautyand",
  delivery_fee_nairobi: 300,
  delivery_fee_other: 500,
  free_delivery_threshold: 10000,
  free_delivery_areas: [],
};

/** Shop details and delivery pricing from public.store_settings (edited in Admin → Settings). */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("*").maybeSingle();
  if (error || !data) return FALLBACK;
  return {
    name: data.name,
    address: data.address,
    landmark: data.landmark,
    hours: data.hours,
    phones: Array.isArray(data.phones) ? data.phones : [],
    whatsapp: data.whatsapp,
    email: data.email,
    map_embed_url: data.map_embed_url,
    directions_url: data.directions_url,
    facebook_url: data.facebook_url ?? null,
    instagram_url: data.instagram_url ?? null,
    delivery_fee_nairobi: Number(data.delivery_fee_nairobi),
    delivery_fee_other: Number(data.delivery_fee_other),
    free_delivery_threshold: Number(data.free_delivery_threshold),
    free_delivery_areas: data.free_delivery_areas ?? [],
  };
});
