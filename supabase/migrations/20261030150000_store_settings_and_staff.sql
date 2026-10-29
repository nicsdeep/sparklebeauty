-- Admin-editable shop settings and staff user management.
--   * store_settings: one row with the shop's contact details (phones, WhatsApp, email,
--     map) and delivery pricing. Anyone can read it; only admins can change it.
--   * delivery_fee(): the single source of the delivery rule; place_order() now uses it.
--   * admin_list_users / admin_save_staff_user / admin_set_user_active: admins add and
--     manage work users without the service-role key.

create table public.store_settings (
  id boolean primary key default true check (id),
  name text not null,
  address text not null,
  landmark text,
  hours text not null,
  phones jsonb not null default '[]'::jsonb,
  whatsapp text,
  email text,
  map_embed_url text,
  directions_url text,
  delivery_fee_nairobi numeric(12,2) not null default 300 check (delivery_fee_nairobi >= 0),
  delivery_fee_other numeric(12,2) not null default 500 check (delivery_fee_other >= 0),
  free_delivery_threshold numeric(12,2) not null default 10000 check (free_delivery_threshold >= 0),
  free_delivery_areas text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.store_settings enable row level security;
create policy "store settings read" on public.store_settings for select to anon, authenticated using (true);
create policy "store settings update (admin)" on public.store_settings for update to authenticated
  using ((select public.is_role_admin())) with check ((select public.is_role_admin()));

insert into public.store_settings (name, address, landmark, hours, phones, whatsapp, map_embed_url, directions_url)
values (
  'Sparkle Beauty & Cosmetics',
  'Kware, Pipeline, Nairobi',
  'Near Redeemed Gospel Church and King Worship Centre',
  'Open daily, 7:00 am – 8:00 pm',
  '[{"label":"Shop 1","number":"0799 912 191"},{"label":"Shop 2","number":"0797 468 963"},{"label":"Shop 2","number":"0719 707 857"}]'::jsonb,
  '+254 727 939 626',
  'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d510575.2266188962!2d36.8737081!3d-1.24993!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f12353c84667f%3A0xcf5304b1a32e7a1e!2sSparkle%20Beauty%20%26%20Cosmetics!5e0!3m2!1sen!2ske!4v1793312220120!5m2!1sen!2ske',
  'https://www.google.com/maps/search/?api=1&query=Sparkle+Beauty+and+Cosmetics+Pipeline+Nairobi'
);

-- Delivery rule: pickup free; free over the threshold or to a free-delivery area (matched
-- against the address and town); Nairobi fee for Nairobi; otherwise the countrywide fee.
-- Mirrored by deliveryFee() in lib/format.ts for the cart estimate.
create or replace function public.delivery_fee(p_method text, p_delivery jsonb, p_amount numeric)
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select case
    when p_method = 'pickup' then 0
    when p_amount >= s.free_delivery_threshold then 0
    when exists (
      select 1 from unnest(s.free_delivery_areas) a
      where trim(a) <> ''
        and lower(concat_ws(' ', p_delivery->>'address_line1', p_delivery->>'address_line2', p_delivery->>'city'))
            like '%' || lower(trim(a)) || '%'
    ) then 0
    when lower(trim(p_delivery->>'city')) = 'nairobi' then s.delivery_fee_nairobi
    else s.delivery_fee_other end
  from public.store_settings s;
$$;

-- place_order: unchanged from 20261029210100 except that delivery uses delivery_fee().
create or replace function public.place_order(
  p_items jsonb,
  p_contact jsonb,
  p_delivery jsonb,
  p_payment_method public.payment_method,
  p_promo_code text default null
)
returns table (order_id uuid, order_number text, total_amount numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tier uuid;
  v_loc uuid := public.main_location_id();
  v_order uuid;
  v_number text;
  v_sub numeric(12,2) := 0;
  v_disc numeric(12,2) := 0;
  v_fee numeric(12,2) := 0;
  v_total numeric(12,2);
  v_method text := coalesce(p_delivery->>'method', 'delivery');
  v_promo public.promotions%rowtype;
  v_line record;
  v_info record;
  v_avail integer;
begin
  if v_uid is null then
    raise exception 'Please sign in to place your order.' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if p_payment_method not in ('mpesa', 'cash', 'card') then
    raise exception 'Choose M-Pesa, card or cash on delivery.';
  end if;
  if coalesce(trim(p_contact->>'full_name'), '') = '' or coalesce(trim(p_contact->>'phone'), '') = '' then
    raise exception 'Please enter your name and phone number.';
  end if;
  if v_method not in ('delivery', 'pickup') then
    raise exception 'Invalid delivery option.';
  end if;
  if v_method = 'delivery' and (coalesce(trim(p_delivery->>'address_line1'), '') = '' or coalesce(trim(p_delivery->>'city'), '') = '') then
    raise exception 'Please enter your delivery address and town.';
  end if;

  select id into v_tier from public.pricing_tiers where code = 'retail';
  v_number := 'SPK-' || nextval('public.order_number_seq');

  insert into public.orders (order_number, customer_id, channel, status, payment_status, pricing_tier_id,
                             shipping_address, delivery_method, customer_name, customer_phone, customer_email, notes)
  values (v_number, v_uid, 'online', 'pending', 'pending', v_tier,
          case when v_method = 'delivery' then p_delivery - 'save' - 'method' else null end,
          v_method, trim(p_contact->>'full_name'), trim(p_contact->>'phone'), nullif(trim(p_contact->>'email'), ''),
          nullif(trim(p_delivery->>'notes'), ''))
  returning id into v_order;

  for v_line in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 50 then
      raise exception 'Invalid quantity in cart.';
    end if;

    select v.sku, p.id as product_id, p.name || coalesce(' – ' || v.name, '') as name, pp.amount
      into v_info
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.product_prices pp on pp.variant_id = v.id and pp.tier_id = v_tier
    where v.id = v_line.variant_id and v.is_active and p.is_active;
    if not found then
      raise exception 'An item in your cart is no longer available.';
    end if;

    select quantity - reserved into v_avail
    from public.inventory_levels where variant_id = v_line.variant_id and location_id = v_loc
    for update;
    if coalesce(v_avail, 0) < v_line.qty then
      raise exception 'Only % left of %. Please update your cart.', coalesce(v_avail, 0), v_info.name;
    end if;

    update public.inventory_levels set reserved = reserved + v_line.qty, updated_at = now()
    where variant_id = v_line.variant_id and location_id = v_loc;
    insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
    values (v_line.variant_id, v_loc, 'reservation', v_line.qty, 'order', v_order, 'Reserved for ' || v_number, v_uid);

    insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total)
    values (v_order, v_line.variant_id, v_info.product_id, v_info.name, v_info.sku, v_line.qty, v_info.amount, v_info.amount * v_line.qty);
    v_sub := v_sub + v_info.amount * v_line.qty;
  end loop;

  if nullif(trim(p_promo_code), '') is not null then
    select * into v_promo from public.promotions
    where upper(code) = upper(trim(p_promo_code)) and is_active
      and starts_at <= now() and (ends_at is null or ends_at > now());
    if not found then
      raise exception 'Promo code % is not valid.', upper(trim(p_promo_code));
    end if;
    if v_sub < v_promo.minimum_order_amount then
      raise exception 'Promo code % needs a minimum order of KES %.', v_promo.code, to_char(v_promo.minimum_order_amount, 'FM999,999');
    end if;
    v_disc := least(v_sub, case when v_promo.discount_type = 'percentage'
                                 then round(v_sub * v_promo.discount_value / 100)
                                 else v_promo.discount_value end);
  end if;

  v_fee := public.delivery_fee(v_method, p_delivery, v_sub - v_disc);
  v_total := v_sub - v_disc + v_fee;

  update public.orders
  set subtotal = v_sub, discount_amount = v_disc, delivery_amount = v_fee, total_amount = v_total,
      promotion_id = case when v_disc > 0 then v_promo.id end
  where id = v_order;

  insert into public.payments (order_id, method, status, amount) values (v_order, p_payment_method, 'pending', v_total);
  insert into public.order_events (order_id, status, note, created_by) values (v_order, 'pending', 'Order placed online', v_uid);

  -- Remember contact details and (optionally) the address for next time.
  update public.profiles
  set full_name = coalesce(nullif(full_name, ''), trim(p_contact->>'full_name')),
      phone = coalesce(nullif(phone, ''), trim(p_contact->>'phone'))
  where id = v_uid;
  if v_method = 'delivery' and coalesce((p_delivery->>'save')::boolean, false)
     and not exists (select 1 from public.customer_addresses
                     where user_id = v_uid and lower(address_line1) = lower(trim(p_delivery->>'address_line1'))) then
    insert into public.customer_addresses (user_id, label, recipient_name, phone, address_line1, address_line2, city, county,
                                           is_default)
    values (v_uid, 'Home', trim(p_contact->>'full_name'), trim(p_contact->>'phone'), trim(p_delivery->>'address_line1'),
            nullif(trim(p_delivery->>'address_line2'), ''), trim(p_delivery->>'city'), nullif(trim(p_delivery->>'county'), ''),
            not exists (select 1 from public.customer_addresses where user_id = v_uid));
  end if;

  perform public.notify_customer(v_order, 'Order received', 'We have received order ' || v_number || '.');
  return query select v_order, v_number, v_total;
end;
$$;

-- Staff user management (admins only) -------------------------------------------------

create or replace function public.admin_list_users()
returns table (id uuid, full_name text, email text, phone text, role public.app_role, active boolean, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_role_admin() then
    raise exception 'Only an admin can manage users.' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, coalesce(p.email, u.email::text), p.phone, p.role,
         (u.banned_until is null or u.banned_until < now()), u.last_sign_in_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role in ('staff', 'admin')
  order by p.role desc, p.full_name;
end;
$$;

-- Creates a work user, or gives an existing account (same email) the role.
create or replace function public.admin_save_staff_user(p_email text, p_full_name text, p_phone text, p_role public.app_role, p_password text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if not public.is_role_admin() then
    raise exception 'Only an admin can manage users.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Enter the person''s name.';
  end if;
  if p_role not in ('staff', 'admin') then
    raise exception 'Work users must be staff or admin.';
  end if;

  select u.id into v_id from auth.users u where lower(u.email) = v_email;
  if v_id is null then
    if p_password is null or length(p_password) < 8 then
      raise exception 'Set a temporary password of at least 8 characters.';
    end if;
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
            extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', trim(p_full_name), 'phone', nullif(trim(p_phone), '')),
            now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now());
  elsif coalesce(p_password, '') <> '' then
    if length(p_password) < 8 then
      raise exception 'Passwords need at least 8 characters.';
    end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = v_id;
  end if;

  if v_id = auth.uid() and p_role <> 'admin' then
    raise exception 'You can''t remove your own admin access.';
  end if;
  update public.profiles
  set role = p_role, full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), email = v_email, updated_at = now()
  where id = v_id;
  update auth.users set banned_until = null where id = v_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'user.saved', 'profile', v_id, jsonb_build_object('email', v_email, 'role', p_role));
  return v_id;
end;
$$;

-- Deactivating blocks sign-in without deleting the person's history.
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_role_admin() then
    raise exception 'Only an admin can manage users.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t deactivate your own account.';
  end if;
  update auth.users
  set banned_until = case when p_active then null else 'infinity'::timestamptz end, updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'User not found.';
  end if;
  if not p_active then
    delete from auth.sessions where user_id = p_user_id;
  end if;
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_active then 'user.activated' else 'user.deactivated' end, 'profile', p_user_id, '{}'::jsonb);
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_save_staff_user(text, text, text, public.app_role, text) from public, anon;
revoke execute on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_save_staff_user(text, text, text, public.app_role, text) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.delivery_fee(text, jsonb, numeric) to anon, authenticated;
