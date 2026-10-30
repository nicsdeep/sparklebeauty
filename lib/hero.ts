import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type HeroBanner = {
  id: string | null;
  image_url: string;
  image_alt: string;
  image_focus: string;
  eyebrow: string | null;
  title: string;
  title_accent: string | null;
  body: string | null;
  primary_label: string;
  primary_href: string;
  secondary_label: string | null;
  secondary_href: string | null;
  trust_text: string | null;
  show_logo: boolean;
};

// Used if no banner can be read (e.g. before the hero_banners migration is applied).
export const DEFAULT_HERO: HeroBanner = {
  id: null,
  image_url: "/brand/hero-banner.jpg",
  image_alt: "Woman with long, glossy black hair surrounded by pink flowers, lipsticks, perfume and makeup",
  image_focus: "100% center",
  eyebrow: "Premium Beauty Products",
  title: "Look good, feel good,",
  title_accent: "be you.",
  body: "Original wigs, braids and top beauty brands at Nairobi prices. Order online, pay with M-Pesa, card or cash on delivery.",
  primary_label: "Shop Now",
  primary_href: "/shop",
  secondary_label: "Explore Categories",
  secondary_href: "/shop",
  trust_text: "Loved by 85K followers on Facebook · 100% recommended",
  show_logo: true,
};

/** The active homepage banner (first by sort_order), edited in Admin → Settings. */
export const getHeroBanner = cache(async (): Promise<HeroBanner> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hero_banners").select("*").eq("is_active", true)
    .order("sort_order").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return DEFAULT_HERO;
  return data as HeroBanner;
});
