// Announcement bar types, safe to import from client components.

/** Icons an announcement can use; the same list is enforced by a check constraint in the database. */
export const ANNOUNCEMENT_ICONS = ["truck", "badge-check", "sparkles", "map-pin", "package", "shield", "gift", "heart"] as const;
export type AnnouncementIcon = (typeof ANNOUNCEMENT_ICONS)[number];

export type Announcement = {
  id: string;
  /** Desktop wording. *phrase* is highlighted; {free_threshold} becomes the free-delivery amount. */
  text: string;
  /** Shorter wording for phones (falls back to `text`). */
  mobile_text: string | null;
  icon: AnnouncementIcon;
  href: string | null;
  is_active: boolean;
  sort_order: number;
};
