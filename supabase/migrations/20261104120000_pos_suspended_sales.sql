-- Suspended POS sales (Nicholas, 2026-11-04). A cashier can suspend a sale: the cart, customer,
-- discount and notes are saved here, and its units are held for 24 hours by moving them into
-- inventory_levels.reserved (the same hold online orders use), so the website and every till
-- see them as unavailable at once. On Hand = Available + Reserved.
--
-- The hold ends one of three ways:
--   completed - the customer pays: pos_complete_suspended_sale releases the hold and records the
--               sale through pos_complete_sale in one transaction, so stock is deducted once.
--   released  - staff release it.
--   expired   - its time runs out: expire_pos_suspensions(), run every minute by pg_cron (and
--               whenever a till lists suspensions, in case the schedule isn't running).
-- Staff can extend the expiry. Every step is recorded in pos_suspension_events.

create type public.suspension_status as enum ('active', 'completed', 'released', 'expired');

create sequence public.suspension_number_seq start 1001;

create table public.pos_suspensions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SUS-' || lpad(nextval('public.suspension_number_seq')::text, 6, '0')),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text,
  customer_phone text,
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  notes text,
  status public.suspension_status not null default 'active',
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null
);
create index idx_pos_suspensions_active on public.pos_suspensions (expires_at) where status = 'active';
create index idx_pos_suspensions_customer on public.pos_suspensions (customer_id);
create index idx_pos_suspensions_created_by on public.pos_suspensions (created_by);
create index idx_pos_suspensions_closed_by on public.pos_suspensions (closed_by);
create index idx_pos_suspensions_order on public.pos_suspensions (order_id);

-- unit_price: the engine's price when suspended (shown in the list; the sale is re-priced on payment).
create table public.pos_suspension_items (
  suspension_id uuid not null references public.pos_suspensions(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  primary key (suspension_id, variant_id)
);
create index idx_pos_suspension_items_variant on public.pos_suspension_items (variant_id);

create table public.pos_suspension_events (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.pos_suspensions(id) on delete cascade,
  action text not null check (action in ('suspended', 'extended', 'completed', 'released', 'expired')),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_pos_suspension_events_suspension on public.pos_suspension_events (suspension_id);
create index idx_pos_suspension_events_created_by on public.pos_suspension_events (created_by);

-- Staff read them; every change goes through the functions below.
alter table public.pos_suspensions enable row level security;
alter table public.pos_suspension_items enable row level security;
alter table public.pos_suspension_events enable row level security;
create policy "pos suspensions read (staff)" on public.pos_suspensions for select to authenticated using ((select public.is_admin()));
create policy "pos suspension items read (staff)" on public.pos_suspension_items for select to authenticated using ((select public.is_admin()));
create policy "pos suspension events read (staff)" on public.pos_suspension_events for select to authenticated using ((select public.is_admin()));

-- Every till's list follows changes live (staff-only topic).
create trigger pos_suspensions_broadcast after insert or update on public.pos_suspensions
  for each statement execute function public.broadcast_admin();

-- Suspend -----------------------------------------------------------------------------------------

create or replace function public.pos_suspend_sale(
  p_customer_id uuid,
  p_items jsonb,
  p_discount_pct numeric default 0,
  p_notes text default null,
  p_expires_at timestamptz default null
)
returns table (id uuid, reference text, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_loc uuid := public.main_location_id();
  v_expires timestamptz := coalesce(p_expires_at, now() + interval '24 hours');
  v_customer public.profiles%rowtype;
  v_id uuid;
  v_ref text;
  v_line record;
  v_name text;
  v_avail integer;
  v_price numeric;
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty.';
  end if;
  if v_expires <= now() or v_expires > now() + interval '7 days' then
    raise exception 'A suspension must end within the next 7 days.';
  end if;
  if p_customer_id is not null then
    select * into v_customer from public.profiles where profiles.id = p_customer_id;
  end if;

  insert into public.pos_suspensions (customer_id, customer_name, customer_phone, discount_pct, notes, expires_at, created_by)
  values (p_customer_id, coalesce((select w.business_name from public.wholesale_accounts w where w.profile_id = p_customer_id), v_customer.full_name),
          v_customer.phone, coalesce(p_discount_pct, 0), nullif(trim(p_notes), ''), v_expires, v_uid)
  returning pos_suspensions.id, pos_suspensions.reference into v_id, v_ref;

  for v_line in
    select (x->>'variant_id')::uuid as variant_id, sum((x->>'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_items) x group by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'Invalid quantity in the cart.';
    end if;
    select p.name || coalesce(' – ' || v.name, '') into v_name
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = v_line.variant_id and v.is_active and p.is_active;
    if not found then
      raise exception 'An item in the cart is no longer available.';
    end if;

    select quantity - reserved into v_avail
    from public.inventory_levels where variant_id = v_line.variant_id and location_id = v_loc
    for update;
    if coalesce(v_avail, 0) < v_line.qty then
      raise exception 'Only % left of %.', coalesce(v_avail, 0), v_name;
    end if;
    update public.inventory_levels set reserved = reserved + v_line.qty, updated_at = now()
    where variant_id = v_line.variant_id and location_id = v_loc;
    insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
    values (v_line.variant_id, v_loc, 'reservation', v_line.qty, 'pos_suspension', v_id, 'Suspended ' || v_ref, v_uid);

    select pl.unit_price into v_price from public.price_line(p_customer_id, v_line.variant_id, v_line.qty) pl;
    insert into public.pos_suspension_items (suspension_id, variant_id, name, quantity, unit_price)
    values (v_id, v_line.variant_id, v_name, v_line.qty, coalesce(v_price, 0));
  end loop;

  insert into public.pos_suspension_events (suspension_id, action, expires_at, created_by) values (v_id, 'suspended', v_expires, v_uid);
  return query select v_id, v_ref, v_expires;
end;
$$;
revoke execute on function public.pos_suspend_sale(uuid, jsonb, numeric, text, timestamptz) from public, anon;
grant execute on function public.pos_suspend_sale(uuid, jsonb, numeric, text, timestamptz) to authenticated;

-- Ends an active suspension and gives its held units back to Available (internal).
create or replace function public.close_pos_suspension(p_id uuid, p_status public.suspension_status)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s public.pos_suspensions%rowtype;
  v_item record;
  v_loc uuid := public.main_location_id();
begin
  select * into v_s from public.pos_suspensions where id = p_id for update;
  if not found or v_s.status <> 'active' then
    return false;
  end if;
  for v_item in select variant_id, quantity from public.pos_suspension_items where suspension_id = p_id loop
    update public.inventory_levels set reserved = greatest(reserved - v_item.quantity, 0), updated_at = now()
    where variant_id = v_item.variant_id and location_id = v_loc;
    insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, reference_id, notes, created_by)
    values (v_item.variant_id, v_loc, 'release', -v_item.quantity, 'pos_suspension', p_id,
            initcap(p_status::text) || ' ' || v_s.reference, auth.uid());
  end loop;
  update public.pos_suspensions set status = p_status, closed_at = now(), closed_by = auth.uid() where id = p_id;
  insert into public.pos_suspension_events (suspension_id, action, created_by) values (p_id, p_status::text, auth.uid());
  return true;
end;
$$;
revoke execute on function public.close_pos_suspension(uuid, public.suspension_status) from public, anon, authenticated;

-- Staff release a suspension.
create or replace function public.pos_release_suspension(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  if not public.close_pos_suspension(p_id, 'released') then
    raise exception 'This suspension has already ended.';
  end if;
end;
$$;
revoke execute on function public.pos_release_suspension(uuid) from public, anon;
grant execute on function public.pos_release_suspension(uuid) to authenticated;

-- Staff move the expiry (later or earlier), within 7 days from now.
create or replace function public.pos_extend_suspension(p_id uuid, p_expires_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Choose a time within the next 7 days.';
  end if;
  update public.pos_suspensions set expires_at = p_expires_at where id = p_id and status = 'active' and expires_at > now();
  if not found then
    raise exception 'This suspension has already ended.';
  end if;
  insert into public.pos_suspension_events (suspension_id, action, expires_at, created_by) values (p_id, 'extended', p_expires_at, auth.uid());
  return p_expires_at;
end;
$$;
revoke execute on function public.pos_extend_suspension(uuid, timestamptz) from public, anon;
grant execute on function public.pos_extend_suspension(uuid, timestamptz) to authenticated;

-- Releases every suspension whose time has run out. Returns how many.
create or replace function public.expire_pos_suspensions()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in select id from public.pos_suspensions where status = 'active' and expires_at <= now() order by expires_at loop
    if public.close_pos_suspension(v_id, 'expired') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.expire_pos_suspensions() from public, anon;
grant execute on function public.expire_pos_suspensions() to authenticated;

-- Pay for a suspended sale: release its hold and record the sale (whatever the cart now holds)
-- in one transaction. If the sale fails, the hold stays.
create or replace function public.pos_complete_suspended_sale(
  p_suspension_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payments jsonb,
  p_client_ref text default null
)
returns table (order_id uuid, order_number text, total_amount numeric, change_due numeric, payments jsonb, duplicate boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s public.pos_suspensions%rowtype;
  v_result record;
begin
  if not public.is_admin() then
    raise exception 'Only staff can use the POS.' using errcode = '42501';
  end if;
  select * into v_s from public.pos_suspensions where id = p_suspension_id for update;
  if not found then
    raise exception 'Suspended sale not found.';
  end if;
  if v_s.status = 'active' then
    perform public.close_pos_suspension(p_suspension_id, case when v_s.expires_at <= now() then 'expired' else 'completed' end::public.suspension_status);
  end if;

  select * into v_result from public.pos_complete_sale(p_customer_id, p_items, p_discount, p_payments, p_client_ref, null);
  if v_s.status = 'active' then
    update public.pos_suspensions set order_id = v_result.order_id where id = p_suspension_id;
  end if;
  return query select v_result.order_id, v_result.order_number, v_result.total_amount, v_result.change_due, v_result.payments, v_result.duplicate;
end;
$$;
revoke execute on function public.pos_complete_suspended_sale(uuid, uuid, jsonb, numeric, jsonb, text) from public, anon;
grant execute on function public.pos_complete_suspended_sale(uuid, uuid, jsonb, numeric, jsonb, text) to authenticated;

-- Run the expiry every minute. If pg_cron isn't available the migration still applies, and tills
-- expire due suspensions whenever they list them.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-pos-suspensions', '* * * * *', 'select public.expire_pos_suspensions()');
exception when others then
  raise notice 'pg_cron not available (%); suspensions expire when a till lists them.', sqlerrm;
end
$cron$;
