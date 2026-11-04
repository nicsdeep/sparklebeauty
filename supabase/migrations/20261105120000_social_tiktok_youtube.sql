-- TikTok and YouTube links for the storefront footer. Nullable: an icon shows only once an admin
-- sets the link in Admin → Settings. Existing RLS on store_settings (admin-only updates) covers them.
alter table public.store_settings
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text;
