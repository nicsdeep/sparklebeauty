-- One pricing engine, one inventory, live updates.
--
-- Pricing (single source of truth, used by website cart, checkout, POS and offline POS):
--   price_breaks(customer, variants) resolves, per variant, the unit price by quantity:
--     1. customer_prices         - a price negotiated for this customer        (rule 'negotiated')
--     2. the customer's wholesale account tier                               (rule 'customer_tier')
--     3. quantity >= wholesale tier's min_order_quantity (10) -> wholesale    (rule 'quantity')
--     4. retail                                                              (rule 'retail')
--   Rules 1-2 give one price for any quantity; otherwise there are two breaks (1+ retail,
--   10+ wholesale). Screens show these breaks optimistically and confirm with quote_cart /
--   pos_quote; place_order and pos_complete_sale price every line through the same function.
--
-- Orders record their channel: 'online', 'pos', or 'wholesale' (any sale to a wholesale
-- account), and each line records which price rule applied.
--
-- POS offline: pos_complete_sale takes a client reference (unique per sale) so a queued sale that
-- is retried can never be recorded twice, plus the time it was taken offline. Stock is still
-- checked and deducted atomically on the server; a queued sale that no longer fits the stock is
-- refused, never forced negative.
--
-- Live updates: stock/catalogue changes are broadcast on the public 'catalog' topic (variant id
-- and available quantity only); order/customer changes go to the private 'admin' topic, which
-- only staff can receive.

alter type public.sales_channel add value if not exists 'wholesale';

-- Wholesale price kicks in automatically at 10+ units of a product.
update public.pricing_tiers set min_order_quantity = 10 where code = 'wholesale';

alter table public.inventory_levels
  add constraint inventory_levels_reserved_within_quantity check (reserved <= quantity);

alter table public.order_items add column price_rule text
  check (price_rule in ('negotiated', 'customer_tier', 'quantity', 'retail'));
alter table public.orders add column client_ref text;
create unique index orders_client_ref_key on public.orders (client_ref) where client_ref is not null;

-- Negotiated prices ------------------------------------------------------------------------------

create table public.customer_prices (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (customer_id, variant_id)
);
create index idx_customer_prices_variant on public.customer_prices (variant_id);
alter table public.customer_prices enable row level security;
create policy "customer prices read" on public.customer_prices for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "customer prices insert (staff)" on public.customer_prices for insert to authenticated with check ((select public.is_admin()));
create policy "customer prices update (staff)" on public.customer_prices for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "customer prices delete (staff)" on public.customer_prices for delete to authenticated using ((select public.is_admin()));

-- The engine ------------------------------------------------------------------------------------

create or replace function public.price_breaks(p_customer_id uuid, p_variant_ids uuid[])
returns table (variant_id uuid, min_qty integer, unit_price numeric, rule text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with params as (
    select (select id from public.pricing_tiers where code = 'retail') as retail_tier,
           (select id from public.pricing_tiers where code = 'wholesale') as wholesale_tier,
           (select min_order_quantity from public.pricing_tiers where code = 'wholesale') as threshold,
           (select pricing_tier_id from public.wholesale_accounts where profile_id = p_customer_id) as customer_tier
  ),
  v as (
    select pv.id,
           rp.amount as retail,
           wp.amount as wholesale,
           ctp.amount as tier_price,
           cp.amount as negotiated
    from public.product_variants pv
    cross join params
    join public.product_prices rp on rp.variant_id = pv.id and rp.tier_id = params.retail_tier
    left join public.product_prices wp on wp.variant_id = pv.id and wp.tier_id = params.wholesale_tier
    left join public.product_prices ctp on ctp.variant_id = pv.id and ctp.tier_id = params.customer_tier
    left join public.customer_prices cp on cp.variant_id = pv.id and cp.customer_id = p_customer_id
    where pv.id = any(p_variant_ids)
  )
  -- Negotiated or customer-tier prices apply to every quantity.
  select v.id, 1, coalesce(v.negotiated, v.tier_price, v.retail),
         case when v.negotiated is not null then 'negotiated' when v.tier_price is not null then 'customer_tier' else 'retail' end
  from v
  union all
  -- Otherwise the wholesale price starts at the threshold (only if it is actually cheaper).
  select v.id, params.threshold, v.wholesale, 'quantity'
  from v cross join params
  where v.negotiated is null and v.tier_price is null and v.wholesale is not null and v.wholesale < v.retail;
$$;
revoke execute on function public.price_breaks(uuid, uuid[]) from public, anon, authenticated;

-- One line's price: the highest break at or below the quantity.
create or replace function public.price_line(p_customer_id uuid, p_variant_id uuid, p_quantity integer)
returns table (unit_price numeric, retail_price numeric, rule text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.unit_price,
         (select pp.amount from public.product_prices pp join public.pricing_tiers t on t.id = pp.tier_id
          where pp.variant_id = p_variant_id and t.code = 'retail'),
         b.rule
  from public.price_breaks(p_customer_id, array[p_variant_id]) b
  where b.min_qty <= p_quantity
  order by b.min_qty desc
  limit 1;
$$;
revoke execute on function public.price_line(uuid, uuid, integer) from public, anon, authenticated;

-- Shared by both quote entry points: price + live availability per line.
create or replace function public.price_cart(p_customer_id uuid, p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  with items as (
    select (e->>'variant_id')::uuid as variant_id, greatest(1, sum((e->>'quantity')::int))::int as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    group by 1
  )
  select i.variant_id, i.qty, pl.unit_price, pl.retail_price, pl.rule, pl.unit_price * i.qty,
         coalesce((select l.quantity - l.reserved from public.inventory_levels l
                   where l.variant_id = i.variant_id and l.location_id = public.main_location_id()), 0),
         (select jsonb_agg(jsonb_build_object('min_qty', b.min_qty, 'unit_price', b.unit_price, 'rule', b.rule) order by b.min_qty)
          from public.price_breaks(p_customer_id, array[i.variant_id]) b)
  from items i
  cross join lateral public.price_line(p_customer_id, i.variant_id, i.qty) pl;
$$;
revoke execute on function public.price_cart(uuid, jsonb) from public, anon, authenticated;

-- Website: prices for the signed-in customer (or a guest).
create or replace function public.quote_cart(p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.price_cart(auth.uid(), p_items);
$$;
revoke execute on function public.quote_cart(jsonb) from public;
grant execute on function public.quote_cart(jsonb) to anon, authenticated;

-- POS: staff price a sale for the selected customer (null = walk-in).
create or replace function public.pos_quote(p_customer_id uuid, p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  return query select * from public.price_cart(p_customer_id, p_items);
end;
$$;
revoke execute on function public.pos_quote(uuid, jsonb) from public, anon;
grant execute on function public.pos_quote(uuid, jsonb) to authenticated;

-- POS price sheet: price breaks for every variant for a customer, so the till can price
-- instantly (and while offline) from the server's own rules.
create or replace function public.pos_price_sheet(p_customer_id uuid)
returns table (variant_id uuid, min_qty integer, unit_price numeric, rule text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  return query select * from public.price_breaks(p_customer_id, array(select id from public.product_variants where is_active));
end;
$$;
revoke execute on function public.pos_price_sheet(uuid) from public, anon;
grant execute on function public.pos_price_sheet(uuid) to authenticated;

-- Website checkout ------------------------------------------------------------------------------

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
  v_wholesale_account boolean;
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
  v_price record;
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

  select pricing_tier_id into v_tier from public.wholesale_accounts where profile_id = v_uid;
  v_wholesale_account := v_tier is not null;
  if v_tier is null then
    select id into v_tier from public.pricing_tiers where code = 'retail';
  end if;
  v_number := 'SPK-' || nextval('public.order_number_seq');

  insert into public.orders (order_number, customer_id, channel, status, payment_status, pricing_tier_id,
                             shipping_address, delivery_method, customer_name, customer_phone, customer_email, notes)
  values (v_number, v_uid, case when v_wholesale_account then 'wholesale' else 'online' end::public.sales_channel, 'pending', 'pending', v_tier,
          case when v_method = 'delivery' then p_delivery - 'save' - 'method' else null end,
          v_method, trim(p_contact->>'full_name'), trim(p_contact->>'phone'), nullif(trim(p_contact->>'email'), ''),
          nullif(trim(p_delivery->>'notes'), ''))
  returning id into v_order;

  for v_line in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 500 then
      raise exception 'Invalid quantity in cart.';
    end if;

    select v.sku, p.id as product_id, p.name || coalesce(' – ' || v.name, '') as name
      into v_info
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_line.variant_id and v.is_active and p.is_active;
    if not found then
      raise exception 'An item in your cart is no longer available.';
    end if;
    select * into v_price from public.price_line(v_uid, v_line.variant_id, v_line.qty);
    if v_price.unit_price is null then
      raise exception 'An item in your cart is no longer available.';
    end if;

    -- Row lock: two checkouts for the last items are served one after the other.
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

    insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total, price_rule)
    values (v_order, v_line.variant_id, v_info.product_id, v_info.name, v_info.sku, v_line.qty, v_price.unit_price,
            v_price.unit_price * v_line.qty, v_price.rule);
    v_sub := v_sub + v_price.unit_price * v_line.qty;
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

-- POS sale ------------------------------------------------------------------------------------

drop function public.pos_complete_sale(uuid, text, jsonb, numeric, public.payment_method, numeric, text);

create or replace function public.pos_complete_sale(
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payment_method public.payment_method,
  p_amount_tendered numeric default null,
  p_mpesa_phone text default null,
  p_client_ref text default null,
  p_offline_at timestamptz default null
)
returns table (order_id uuid, order_number text, total_amount numeric, change_due numeric, payment_reference text, duplicate boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_tier public.pricing_tiers%rowtype;
  v_wholesale_account boolean := false;
  v_loc uuid := public.main_location_id();
  v_order uuid;
  v_number text;
  v_sub numeric(12,2) := 0;
  v_disc numeric(12,2) := coalesce(p_discount, 0);
  v_total numeric(12,2);
  v_line record;
  v_info record;
  v_price record;
  v_avail integer;
  v_ref text;
  v_customer public.profiles%rowtype;
  v_points integer;
  v_existing public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;

  -- A sale retried after a dropped connection (or synced from the offline queue twice) is
  -- returned as-is instead of being recorded again.
  if p_client_ref is not null then
    select * into v_existing from public.orders where client_ref = p_client_ref;
    if found then
      return query select v_existing.id, v_existing.order_number, v_existing.total_amount, 0::numeric,
        (select provider_reference from public.payments where payments.order_id = v_existing.id order by created_at limit 1), true;
      return;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.';
  end if;
  if p_payment_method not in ('mpesa', 'cash', 'card') then
    raise exception 'Choose M-Pesa, cash or card.';
  end if;
  if p_offline_at is not null and p_payment_method <> 'cash' then
    raise exception 'Only cash sales can be taken offline.';
  end if;

  if p_customer_id is not null then
    select * into v_customer from public.profiles where id = p_customer_id and role = 'customer';
    if not found then
      raise exception 'Customer not found.';
    end if;
    select t.* into v_tier from public.wholesale_accounts w join public.pricing_tiers t on t.id = w.pricing_tier_id
    where w.profile_id = p_customer_id;
    v_wholesale_account := found;
  end if;
  if not v_wholesale_account then
    select * into v_tier from public.pricing_tiers where code = 'retail';
  end if;

  v_number := 'SPK-' || nextval('public.order_number_seq');
  insert into public.orders (order_number, customer_id, channel, status, payment_status, pricing_tier_id, delivery_method,
                             customer_name, customer_phone, customer_email, created_by, client_ref, notes)
  values (v_number, p_customer_id, case when v_wholesale_account then 'wholesale' else 'pos' end::public.sales_channel,
          'completed', 'paid', v_tier.id, 'pickup',
          coalesce(nullif(v_customer.full_name, ''), 'Walk-in customer'), v_customer.phone, v_customer.email, v_uid, p_client_ref,
          case when p_offline_at is not null then 'Taken offline at ' || to_char(p_offline_at at time zone 'Africa/Nairobi', 'DD Mon YYYY HH24:MI') end)
  returning id into v_order;

  for v_line in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 500 then
      raise exception 'Invalid quantity.';
    end if;
    select v.sku, p.id as product_id, p.name || coalesce(' – ' || v.name, '') as name
      into v_info
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_line.variant_id and v.is_active;
    if not found then
      raise exception 'Product not available for sale.';
    end if;
    select * into v_price from public.price_line(p_customer_id, v_line.variant_id, v_line.qty);
    if v_price.unit_price is null then
      raise exception '% has no price.', v_info.name;
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
    insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total, price_rule)
    values (v_order, v_line.variant_id, v_info.product_id, v_info.name, v_info.sku, v_line.qty, v_price.unit_price,
            v_price.unit_price * v_line.qty, v_price.rule);
    v_sub := v_sub + v_price.unit_price * v_line.qty;
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
  values (v_order, p_payment_method, 'paid', v_total, v_ref, coalesce(p_offline_at, now()));
  insert into public.order_events (order_id, status, note, created_by)
  values (v_order, 'completed', 'In-store sale (' || v_tier.name || ')'
          || case when p_payment_method = 'mpesa' and p_mpesa_phone is not null then ', M-Pesa ' || p_mpesa_phone else '' end
          || case when p_offline_at is not null then ', synced from offline' else '' end, v_uid);

  if p_customer_id is not null and not v_wholesale_account then
    v_points := floor(v_total / 100);
    if v_points > 0 then
      insert into public.loyalty_transactions (customer_id, order_id, points, reason)
      values (p_customer_id, v_order, v_points, 'Earned in store on ' || v_number);
      update public.profiles set loyalty_points = loyalty_points + v_points, updated_at = now() where id = p_customer_id;
    end if;
  end if;
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'pos.sale', 'order', v_order, jsonb_build_object('order_number', v_number, 'total', v_total, 'tier', v_tier.code,
          'offline', p_offline_at is not null));
  perform public.notify_customer(v_order, 'Thank you for shopping at Sparkle',
    'Your in-store purchase ' || v_number || ' of KES ' || to_char(v_total, 'FM999,999') || ' is complete.');

  return query select v_order, v_number, v_total,
    case when p_payment_method = 'cash' then p_amount_tendered - v_total else 0 end, v_ref, false;
end;
$$;
revoke execute on function public.pos_complete_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz) from public, anon;
grant execute on function public.pos_complete_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz) to authenticated;

-- Live updates ----------------------------------------------------------------------------------

-- Public: availability per variant (no order or customer data).
create or replace function public.broadcast_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform realtime.send(jsonb_build_object('variant_id', new.variant_id, 'available', new.quantity - new.reserved),
                        'stock', 'catalog', false);
  return null;
end;
$$;
create trigger inventory_levels_broadcast after insert or update of quantity, reserved on public.inventory_levels
  for each row execute function public.broadcast_stock();

-- Public: a product, its options or its prices changed (shop pages re-read them).
create or replace function public.broadcast_catalog()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform realtime.send(jsonb_build_object('table', tg_table_name), 'catalog', 'catalog', false);
  return null;
end;
$$;
create trigger products_broadcast after insert or update or delete on public.products
  for each statement execute function public.broadcast_catalog();
create trigger product_variants_broadcast after insert or update or delete on public.product_variants
  for each statement execute function public.broadcast_catalog();
create trigger product_prices_broadcast after insert or update or delete on public.product_prices
  for each statement execute function public.broadcast_catalog();

-- Staff only: orders, payments and customers changed (admin pages re-read them).
create or replace function public.broadcast_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform realtime.send(jsonb_build_object('table', tg_table_name), 'change', 'admin', true);
  return null;
end;
$$;
create trigger orders_broadcast after insert or update on public.orders
  for each statement execute function public.broadcast_admin();
create trigger payments_broadcast after insert or update on public.payments
  for each statement execute function public.broadcast_admin();
create trigger profiles_broadcast after insert or update on public.profiles
  for each statement execute function public.broadcast_admin();

revoke execute on function public.broadcast_stock() from public, anon, authenticated;
revoke execute on function public.broadcast_catalog() from public, anon, authenticated;
revoke execute on function public.broadcast_admin() from public, anon, authenticated;

-- Who may receive the private 'admin' topic: staff only.
create policy "staff receive admin updates" on realtime.messages for select to authenticated
  using (realtime.topic() = 'admin' and (select public.is_admin()));

-- Demo reset keeps the 10+ wholesale rule (the original seed sets 6).
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_role_admin() then
    raise exception 'Only an admin can reset the demo.' using errcode = '42501';
  end if;
  perform public.demo_seed();
  perform public.demo_images();
  perform public.demo_kids_collection();
  perform public.demo_product_details();
  update public.pricing_tiers set min_order_quantity = 10 where code = 'wholesale';
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details) values (auth.uid(), 'demo.reset', null, null, '{}'::jsonb);
end;
$$;
revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;
