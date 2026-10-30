-- Homepage hero as data: the background artwork (image only, no text baked in) and the
-- foreground copy are stored separately, so the banner can be swapped without redesigning
-- the page. The site shows the first active banner by sort_order. Admins edit it in Settings.

create table public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  image_alt text not null default '',
  -- Which part of the artwork to keep in view when it's cropped, e.g. on phones (CSS object-position).
  image_focus text not null default '75% center',
  eyebrow text,
  title text not null,
  title_accent text,
  body text,
  primary_label text not null default 'Shop Now',
  primary_href text not null default '/shop',
  secondary_label text,
  secondary_href text,
  trust_text text,
  show_logo boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.hero_banners enable row level security;
create policy "hero banners read (anon)" on public.hero_banners for select to anon using (is_active);
create policy "hero banners read" on public.hero_banners for select to authenticated using (is_active or (select public.is_role_admin()));
create policy "hero banners insert (admin)" on public.hero_banners for insert to authenticated with check ((select public.is_role_admin()));
create policy "hero banners update (admin)" on public.hero_banners for update to authenticated using ((select public.is_role_admin())) with check ((select public.is_role_admin()));
create policy "hero banners delete (admin)" on public.hero_banners for delete to authenticated using ((select public.is_role_admin()));

insert into public.hero_banners (image_url, image_alt, image_focus, eyebrow, title, title_accent, body,
                                 primary_label, primary_href, secondary_label, secondary_href, trust_text)
values ('/brand/hero-banner.jpg',
        'Woman with long, glossy black hair surrounded by pink flowers, lipsticks, perfume and makeup',
        '72% center',
        'Premium Beauty Products',
        'Look good, feel good,',
        'be you.',
        'Original wigs, braids and top beauty brands at Nairobi prices. Order online, pay with M-Pesa, card or cash on delivery.',
        'Shop Now', '/shop',
        'Explore Categories', '/shop',
        'Loved by 85K followers on Facebook · 100% recommended');
