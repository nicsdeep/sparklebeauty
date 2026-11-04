import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ANNOUNCEMENT_ICONS, type Announcement, type AnnouncementIcon } from "@/lib/announcement-types";

// Used if the announcements table can't be read (e.g. before its migration is applied).
const FALLBACK: Omit<Announcement, "id">[] = [
  { text: "Free delivery on orders over *KES {free_threshold}*", mobile_text: "Free delivery over *KES {free_threshold}*", icon: "truck", href: "/delivery", is_active: true, sort_order: 1 },
  { text: "Original beauty products from *trusted brands*", mobile_text: "Original products, *trusted brands*", icon: "badge-check", href: null, is_active: true, sort_order: 2 },
  { text: "Fast delivery across *Kenya*", mobile_text: "Fast delivery across *Kenya*", icon: "map-pin", href: "/delivery", is_active: true, sort_order: 3 },
  { text: "*Track your order* from purchase to delivery", mobile_text: "*Track your order* to your door", icon: "package", href: "/account#orders", is_active: true, sort_order: 4 },
];

/** Every announcement (admins also see inactive ones), in display order. */
export const getAnnouncements = cache(async (): Promise<Announcement[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").select("id, text, mobile_text, icon, href, is_active, sort_order").order("sort_order").order("updated_at");
  if (error || !data) return FALLBACK.map((a, i) => ({ ...a, id: `fallback-${i}` }));
  return data.map((a) => ({ ...a, icon: (ANNOUNCEMENT_ICONS as readonly string[]).includes(a.icon) ? (a.icon as AnnouncementIcon) : "sparkles" }));
});

/** Fills in {free_threshold} with the live free-delivery amount, so the bar never drifts from checkout. */
export function resolveAnnouncement(text: string, freeThreshold: number) {
  return text.replaceAll("{free_threshold}", Math.round(freeThreshold).toLocaleString("en-KE"));
}
