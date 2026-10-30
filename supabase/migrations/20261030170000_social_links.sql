-- Social media links for the shop, from its Facebook page (2026-10-30). Editable in Admin → Settings.
alter table public.store_settings
  add column if not exists facebook_url text,
  add column if not exists instagram_url text;

update public.store_settings
set facebook_url = 'https://www.facebook.com/Sparklebeautyandcosmetics',
    instagram_url = 'https://www.instagram.com/sparkle_beautyand'
where id;
