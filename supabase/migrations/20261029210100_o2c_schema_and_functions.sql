-- Order-to-Cash: schema additions and the business functions the app calls.
-- All money and stock changes go through these SECURITY DEFINER functions, which check
-- who is calling and validate input. The app never needs the service-role key.

-- Schema --------------------------------------------------------------------------

create sequence if not exists public.order_number_seq start 1001;

alter table public.inventory_levels
  add column if not exists reserved integer not null default 0;
alter table public.inventory_levels
  add constraint inventory_levels_reserved_check check (reserved >= 0 and reserved <= quantity);

alter table public.profiles
  add column if not exists email text,
  add column if not exists date_of_birth date,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_sms boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default false;

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists delivery_method text not null default 'delivery'
    check (delivery_method in ('delivery', 'pickup')),
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.order_items
  add column if not exists product_id uuid references public.products(id) on delete set null;

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_order_events_order on public.order_events (order_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, created_at desc);

create table public.wholesale_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null,
  business_location text,
  pricing_tier_id uuid not null references public.pricing_tiers(id),
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_log_created on public.activity_log (created_at desc);

alter table public.order_events enable row level security;
alter table public.notifications enable row level security;
alter table public.wholesale_accounts enable row level security;
alter table public.activity_log enable row level security;

create policy "order events read" on public.order_events for select to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.orders o where o.id = order_events.order_id and o.customer_id = (select auth.uid())));

create policy "notifications read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "notifications mark read (own)" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "wholesale accounts read" on public.wholesale_accounts for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy "wholesale accounts insert (staff)" on public.wholesale_accounts for insert to authenticated with check ((select public.is_admin()));
create policy "wholesale accounts update (staff)" on public.wholesale_accounts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "wholesale accounts delete (staff)" on public.wholesale_accounts for delete to authenticated using ((select public.is_admin()));

create policy "activity log read (staff)" on public.activity_log for select to authenticated using ((select public.is_admin()));

-- The storefront needs tier codes to pick the retail price; tier names aren't sensitive.
drop policy if exists "pricing tiers (staff)" on public.pricing_tiers;
create policy "pricing tiers read" on public.pricing_tiers for select to anon, authenticated using (true);
create policy "pricing tiers insert (staff)" on public.pricing_tiers for insert to authenticated with check ((select public.is_admin()));
create policy "pricing tiers update (staff)" on public.pricing_tiers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "pricing tiers delete (staff)" on public.pricing_tiers for delete to authenticated using ((select public.is_admin()));

-- Keep the profile email in sync on sign-up so staff can see it in the CRM.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone', new.email);
  return new;
end;
$$;

-- Helpers -------------------------------------------------------------------------

create or replace function public.main_location_id()
returns uuid
language sql
stable
set search_path to 'public'
as $$
  select id from public.inventory_locations where is_active order by created_at limit 1;
$$;

create or replace function public.mpesa_reference()
returns text
language sql
volatile
as $$
  select 'S' || upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 9));
$$;

create or replace function public.notify_customer(p_order_id uuid, p_title text, p_body text)
returns void
language sql
set search_path to 'public'
as $$
  insert into public.notifications (user_id, title, body, link)
  select o.customer_id, p_title, p_body, '/order/' || o.order_number
  from public.orders o where o.id = p_order_id and o.customer_id is not null;
$$;

-- Storefront stock: available = on hand - reserved for open orders.
drop function if exists public.get_variant_stock(uuid[]);
create function public.get_variant_stock(p_variant_ids uuid[])
returns table (variant_id uuid, quantity_available integer, in_stock boolean, low_stock boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.id,
         greatest(coalesce(sum(l.quantity - l.reserved) filter (where loc.is_active), 0), 0)::integer,
         coalesce(sum(l.quantity - l.reserved) filter (where loc.is_active), 0) > 0,
         coalesce(sum(l.quantity - l.reserved) filter (where loc.is_active), 0) > 0
           and coalesce(sum(l.quantity - l.reserved) filter (where loc.is_active), 0) <= coalesce(max(l.reorder_level), 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_levels l on l.variant_id = v.id
  left join public.inventory_locations loc on loc.id = l.location_id
  where v.id = any(p_variant_ids) and v.is_active and p.is_active
  group by v.id;
$$;

-- Online checkout -----------------------------------------------------------------

-- p_items:    [{"variant_id": uuid, "quantity": int}]
-- p_contact:  {"full_name", "phone", "email"}
-- p_delivery: {"method": "delivery"|"pickup", "address_line1", "address_line2", "city", "county", "notes", "save": bool}
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

  v_fee := case
    when v_method = 'pickup' then 0
    when v_sub - v_disc >= 10000 then 0
    when lower(trim(p_delivery->>'city')) = 'nairobi' then 300
    else 500 end;
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

-- Simulated payment confirmation (M-Pesa STK push or card) for the customer's own order.
create or replace function public.pay_order(p_order_id uuid, p_phone text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_pay public.payments%rowtype;
  v_ref text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id is distinct from v_uid then
    raise exception 'Order not found.';
  end if;
  if v_order.payment_status = 'paid' then
    select provider_reference into v_ref from public.payments where order_id = p_order_id and status = 'paid' limit 1;
    return v_ref;
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order was cancelled.';
  end if;
  select * into v_pay from public.payments where order_id = p_order_id and status = 'pending' order by created_at limit 1;
  if not found or v_pay.method not in ('mpesa', 'card') then
    raise exception 'This order is paid on delivery.';
  end if;

  v_ref := case when v_pay.method = 'mpesa' then public.mpesa_reference()
                else 'CARD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)) end;
  update public.payments set status = 'paid', paid_at = now(), provider_reference = v_ref where id = v_pay.id;
  update public.orders set payment_status = 'paid', updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, status, note, created_by)
  values (p_order_id, v_order.status,
          case when v_pay.method = 'mpesa' then 'M-Pesa payment received from ' || coalesce(p_phone, v_order.customer_phone) || ' (' || v_ref || ')'
               else 'Card payment approved (' || v_ref || ')' end,
          v_uid);
  perform public.notify_customer(p_order_id, 'Payment received',
    'Thank you! We received KES ' || to_char(v_order.total_amount, 'FM999,999') || ' for order ' || v_order.order_number || '.');
  return v_ref;
end;
$$;

-- Admin order processing -----------------------------------------------------------

create or replace function public.advance_order(p_order_id uuid, p_note text default null)
returns public.order_status
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_flow public.order_status[] := array['pending', 'confirmed', 'paid', 'processing', 'packed', 'dispatched', 'delivered', 'completed']::public.order_status[];
  v_order public.orders%rowtype;
  v_pos integer;
  v_next public.order_status;
  v_item record;
  v_points integer;
  v_msg text;
begin
  if not public.is_admin() then
    raise exception 'Only staff can update orders.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  v_pos := array_position(v_flow, v_order.status);
  if v_pos is null or v_pos = array_length(v_flow, 1) then
    raise exception 'Order % is % and cannot move forward.', v_order.order_number, v_order.status;
  end if;
  v_next := v_flow[v_pos + 1];

  if v_next = 'paid' and v_order.payment_status <> 'paid' then
    -- Staff confirm a cash payment (e.g. cash on delivery collected in advance or at the shop).
    update public.payments
    set status = 'paid', paid_at = now(),
        provider_reference = coalesce(provider_reference,
          case when method = 'mpesa' then public.mpesa_reference() else 'CASH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)) end)
    where order_id = p_order_id and status = 'pending';
    update public.orders set payment_status = 'paid' where id = p_order_id;
  end if;

  if v_next = 'dispatched' then
    for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id and variant_id is not null loop
      update public.inventory_levels
      set quantity = quantity - v_item.quantity, reserved = greatest(reserved - v_item.quantity, 0), updated_at = now()
      where variant_id = v_item.variant_id and location_id = public.main_location_id();
      insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
      values (v_item.variant_id, public.main_location_id(), 'sale', -v_item.quantity, 'order', p_order_id, 'Dispatched ' || v_order.order_number, v_uid);
    end loop;
  end if;

  if v_next = 'completed' and v_order.customer_id is not null then
    v_points := floor(v_order.total_amount / 100);
    if v_points > 0 then
      insert into public.loyalty_transactions (customer_id, order_id, points, reason)
      values (v_order.customer_id, p_order_id, v_points, 'Earned on order ' || v_order.order_number);
      update public.profiles set loyalty_points = loyalty_points + v_points, updated_at = now() where id = v_order.customer_id;
    end if;
  end if;

  update public.orders set status = v_next, updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, status, note, created_by) values (p_order_id, v_next, nullif(trim(p_note), ''), v_uid);
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'order.' || v_next, 'order', p_order_id, jsonb_build_object('order_number', v_order.order_number));

  v_msg := case v_next
    when 'confirmed' then 'Your order ' || v_order.order_number || ' has been confirmed.'
    when 'paid' then 'Payment for ' || v_order.order_number || ' is confirmed.'
    when 'processing' then 'We are preparing your order ' || v_order.order_number || '.'
    when 'packed' then 'Your order ' || v_order.order_number || ' is packed.'
    when 'dispatched' then case when v_order.delivery_method = 'pickup'
                                then 'Your order ' || v_order.order_number || ' is ready for pickup at the shop.'
                                else 'Your order ' || v_order.order_number || ' is on its way.' end
    when 'delivered' then 'Your order ' || v_order.order_number || ' has been delivered.'
    when 'completed' then 'Order ' || v_order.order_number || ' is complete'
                          || case when coalesce(v_points, 0) > 0 then '. You earned ' || v_points || ' loyalty points!' else '.' end
  end;
  perform public.notify_customer(p_order_id, 'Order update', v_msg);
  return v_next;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'Only staff can cancel orders.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status not in ('pending', 'confirmed', 'paid', 'processing', 'packed') then
    raise exception 'Order % is % and can no longer be cancelled.', v_order.order_number, v_order.status;
  end if;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id and variant_id is not null loop
    update public.inventory_levels set reserved = greatest(reserved - v_item.quantity, 0), updated_at = now()
    where variant_id = v_item.variant_id and location_id = public.main_location_id();
    insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
    values (v_item.variant_id, public.main_location_id(), 'release', -v_item.quantity, 'order', p_order_id, 'Cancelled ' || v_order.order_number, v_uid);
  end loop;
  update public.payments set status = case when status = 'paid' then 'refunded'::public.payment_status else 'failed'::public.payment_status end
  where order_id = p_order_id;
  update public.orders
  set status = 'cancelled', payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status else payment_status end,
      updated_at = now()
  where id = p_order_id;
  insert into public.order_events (order_id, status, note, created_by) values (p_order_id, 'cancelled', nullif(trim(p_reason), ''), v_uid);
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'order.cancelled', 'order', p_order_id, jsonb_build_object('order_number', v_order.order_number, 'reason', p_reason));
  perform public.notify_customer(p_order_id, 'Order cancelled', 'Your order ' || v_order.order_number || ' was cancelled.');
end;
$$;

-- POS --------------------------------------------------------------------------------

-- p_items: [{"variant_id": uuid, "quantity": int}]
create or replace function public.pos_complete_sale(
  p_customer_id uuid,
  p_price_tier text,
  p_items jsonb,
  p_discount numeric,
  p_payment_method public.payment_method,
  p_amount_tendered numeric default null,
  p_mpesa_phone text default null
)
returns table (order_id uuid, order_number text, total_amount numeric, change_due numeric, payment_reference text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tier public.pricing_tiers%rowtype;
  v_retail uuid;
  v_loc uuid := public.main_location_id();
  v_order uuid;
  v_number text;
  v_sub numeric(12,2) := 0;
  v_disc numeric(12,2) := coalesce(p_discount, 0);
  v_total numeric(12,2);
  v_qty_total integer := 0;
  v_line record;
  v_info record;
  v_avail integer;
  v_ref text;
  v_customer public.profiles%rowtype;
  v_points integer;
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.';
  end if;
  if p_payment_method not in ('mpesa', 'cash', 'card') then
    raise exception 'Choose M-Pesa, cash or card.';
  end if;
  select * into v_tier from public.pricing_tiers where code = coalesce(p_price_tier, 'retail') and is_active;
  if not found then
    raise exception 'Unknown price tier.';
  end if;
  select id into v_retail from public.pricing_tiers where code = 'retail';

  if p_customer_id is not null then
    select * into v_customer from public.profiles where id = p_customer_id;
    if not found then
      raise exception 'Customer not found.';
    end if;
  end if;
  if v_tier.is_wholesale then
    if p_customer_id is null or not exists (select 1 from public.wholesale_accounts where profile_id = p_customer_id) then
      raise exception 'Wholesale prices need a wholesale customer.';
    end if;
    select coalesce(sum((e->>'quantity')::int), 0) into v_qty_total from jsonb_array_elements(p_items) e;
    if v_qty_total < v_tier.min_order_quantity then
      raise exception 'Wholesale orders need at least % items (this sale has %).', v_tier.min_order_quantity, v_qty_total;
    end if;
  end if;

  v_number := 'SPK-' || nextval('public.order_number_seq');
  insert into public.orders (order_number, customer_id, channel, status, payment_status, pricing_tier_id, delivery_method,
                             customer_name, customer_phone, customer_email, created_by)
  values (v_number, p_customer_id, 'pos', 'completed', 'paid', v_tier.id, 'pickup',
          coalesce(nullif(v_customer.full_name, ''), 'Walk-in customer'), v_customer.phone, v_customer.email, v_uid)
  returning id into v_order;

  for v_line in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 500 then
      raise exception 'Invalid quantity.';
    end if;
    select v.sku, p.id as product_id, p.name || coalesce(' – ' || v.name, '') as name,
           coalesce(tp.amount, rp.amount) as amount
      into v_info
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_prices tp on tp.variant_id = v.id and tp.tier_id = v_tier.id
    left join public.product_prices rp on rp.variant_id = v.id and rp.tier_id = v_retail
    where v.id = v_line.variant_id and v.is_active;
    if not found or v_info.amount is null then
      raise exception 'Product not available for sale.';
    end if;
    select quantity - reserved into v_avail from public.inventory_levels
    where variant_id = v_line.variant_id and location_id = v_loc for update;
    if coalesce(v_avail, 0) < v_line.qty then
      raise exception 'Only % in stock of %.', coalesce(v_avail, 0), v_info.name;
    end if;
    update public.inventory_levels set quantity = quantity - v_line.qty, updated_at = now()
    where variant_id = v_line.variant_id and location_id = v_loc;
    insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
    values (v_line.variant_id, v_loc, 'sale', -v_line.qty, 'order', v_order, 'POS sale ' || v_number, v_uid);
    insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total)
    values (v_order, v_line.variant_id, v_info.product_id, v_info.name, v_info.sku, v_line.qty, v_info.amount, v_info.amount * v_line.qty);
    v_sub := v_sub + v_info.amount * v_line.qty;
  end loop;

  if v_disc < 0 or v_disc > v_sub then
    raise exception 'Discount must be between 0 and the subtotal.';
  end if;
  v_total := v_sub - v_disc;
  if p_payment_method = 'cash' and coalesce(p_amount_tendered, 0) < v_total then
    raise exception 'Cash received (KES %) is less than the total (KES %).', coalesce(p_amount_tendered, 0), v_total;
  end if;

  v_ref := case p_payment_method
    when 'mpesa' then public.mpesa_reference()
    when 'card' then 'CARD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))
    else 'CASH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)) end;
  update public.orders set subtotal = v_sub, discount_amount = v_disc, total_amount = v_total where id = v_order;
  insert into public.payments (order_id, method, status, amount, provider_reference, paid_at)
  values (v_order, p_payment_method, 'paid', v_total, v_ref, now());
  insert into public.order_events (order_id, status, note, created_by)
  values (v_order, 'completed', 'In-store sale (' || v_tier.name || ')'
          || case when p_payment_method = 'mpesa' and p_mpesa_phone is not null then ', M-Pesa ' || p_mpesa_phone else '' end, v_uid);

  if p_customer_id is not null and not v_tier.is_wholesale then
    v_points := floor(v_total / 100);
    if v_points > 0 then
      insert into public.loyalty_transactions (customer_id, order_id, points, reason)
      values (p_customer_id, v_order, v_points, 'Earned in store on ' || v_number);
      update public.profiles set loyalty_points = loyalty_points + v_points, updated_at = now() where id = p_customer_id;
    end if;
  end if;
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'pos.sale', 'order', v_order, jsonb_build_object('order_number', v_number, 'total', v_total, 'tier', v_tier.code));
  perform public.notify_customer(v_order, 'Thank you for shopping at Sparkle',
    'Your in-store purchase ' || v_number || ' of KES ' || to_char(v_total, 'FM999,999') || ' is complete.');

  return query select v_order, v_number, v_total,
    case when p_payment_method = 'cash' then p_amount_tendered - v_total else 0 end, v_ref;
end;
$$;

-- Inventory adjustment (receiving stock, stock counts) by staff.
create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_loc uuid := public.main_location_id();
  v_new integer;
begin
  if not public.is_admin() then
    raise exception 'Only staff can adjust stock.' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'Enter a quantity to add or remove.';
  end if;
  insert into public.inventory_levels (variant_id, location_id, quantity)
  values (p_variant_id, v_loc, 0)
  on conflict (variant_id, location_id) do nothing;
  if (select quantity + p_delta < reserved from public.inventory_levels
      where variant_id = p_variant_id and location_id = v_loc) then
    raise exception 'Stock cannot go below the quantity reserved for open orders.';
  end if;
  update public.inventory_levels set quantity = quantity + p_delta, updated_at = now()
  where variant_id = p_variant_id and location_id = v_loc
  returning quantity into v_new;
  insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, notes, created_by)
  values (p_variant_id, v_loc, case when p_delta > 0 then 'purchase'::public.stock_movement_type else 'adjustment'::public.stock_movement_type end,
          p_delta, 'manual', coalesce(nullif(trim(p_reason), ''), 'Stock adjustment'), v_uid);
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'inventory.adjust', 'variant', p_variant_id, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  return v_new;
end;
$$;

-- Privileges ---------------------------------------------------------------------------

revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text) from public, anon;
revoke execute on function public.pay_order(uuid, text) from public, anon;
revoke execute on function public.advance_order(uuid, text) from public, anon;
revoke execute on function public.cancel_order(uuid, text) from public, anon;
revoke execute on function public.pos_complete_sale(uuid, text, jsonb, numeric, public.payment_method, numeric, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, integer, text) from public, anon;
revoke execute on function public.notify_customer(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.mpesa_reference() from public, anon, authenticated;
revoke execute on function public.main_location_id() from public, anon;
revoke execute on function public.get_variant_stock(uuid[]) from public;
grant execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text) to authenticated;
grant execute on function public.pay_order(uuid, text) to authenticated;
grant execute on function public.advance_order(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.pos_complete_sale(uuid, text, jsonb, numeric, public.payment_method, numeric, text) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
grant execute on function public.main_location_id() to authenticated;
grant execute on function public.get_variant_stock(uuid[]) to anon, authenticated;
grant usage on sequence public.order_number_seq to authenticated;
