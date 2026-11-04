-- Storefront announcement bar as data: short rotating messages, edited in Admin → Settings.
--   text / mobile_text: desktop and phone wording. *phrase* is shown as a highlighted pill, and
--     {free_threshold} is replaced with store_settings.free_delivery_threshold (e.g. KES 10,000).
--   icon: one of the icons the storefront knows; href: optional link (site path or https://).
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 1 and 120),
  mobile_text text check (mobile_text is null or length(mobile_text) between 1 and 60),
  icon text not null default 'sparkles' check (icon in ('truck', 'badge-check', 'sparkles', 'map-pin', 'package', 'shield', 'gift', 'heart')),
  href text check (href is null or href ~ '^(/|https://)'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.announcements enable row level security;
create policy "announcements read (anon)" on public.announcements for select to anon using (is_active);
create policy "announcements read" on public.announcements for select to authenticated using (is_active or (select public.is_role_admin()));
create policy "announcements insert (admin)" on public.announcements for insert to authenticated with check ((select public.is_role_admin()));
create policy "announcements update (admin)" on public.announcements for update to authenticated using ((select public.is_role_admin())) with check ((select public.is_role_admin()));
create policy "announcements delete (admin)" on public.announcements for delete to authenticated using ((select public.is_role_admin()));

insert into public.announcements (text, mobile_text, icon, href, sort_order) values
  ('Free delivery on orders over *KES {free_threshold}*', 'Free delivery over *KES {free_threshold}*', 'truck', '/delivery', 1),
  ('Original beauty products from *trusted brands*', 'Original products, *trusted brands*', 'badge-check', null, 2),
  ('Fast delivery across *Kenya*', 'Fast delivery across *Kenya*', 'map-pin', '/delivery', 3),
  ('*Track your order* from purchase to delivery', '*Track your order* to your door', 'package', '/account#orders', 4);
