-- VAT and KRA eTIMS tax invoices.
--
-- Sparkle is VAT registered and its prices are VAT-exclusive (Nicholas, 2026-10-31): VAT is
-- added on top of the engine's prices, per line, using the product's eTIMS tax type:
--   A exempt, B standard 16%, C zero-rated, D non-VAT, E 8%.
-- If the store is set as not VAT registered, every line is D (no VAT).
--
-- Rule (also in lib/tax.ts, which must match it to the cent):
--   line discount = round(line_total * order_discount / subtotal, 2)
--   taxable       = line_total - line discount
--   line VAT      = round(taxable * rate / 100, 2)
--   delivery VAT  = round(delivery_fee * rate(B) / 100, 2)
--   total         = sum(taxable) + delivery_fee + sum(line VAT) + delivery VAT
--
-- A tax invoice is issued automatically when an order is paid (online payment, cash on
-- delivery collected, or a till sale), and a credit note when a paid order is refunded.
-- Each one waits in the eTIMS queue (etims_status 'pending') until the KRA eTIMS connection is
-- set up; nothing is marked as sent to KRA until KRA has actually accepted it.

-- Settings and columns ---------------------------------------------------------------------------

create type public.etims_tax_type as enum ('A', 'B', 'C', 'D', 'E');

alter table public.store_settings
  add column kra_pin text check (kra_pin is null or kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  add column vat_registered boolean not null default true;

alter table public.profiles
  add column kra_pin text check (kra_pin is null or kra_pin ~ '^[AP][0-9]{9}[A-Z]$');

alter table public.products
  add column tax_type public.etims_tax_type not null default 'B';

alter table public.orders
  add column tax_amount numeric(12,2) not null default 0;

alter table public.order_items
  add column tax_type public.etims_tax_type,
  add column tax_rate numeric(5,2) not null default 0,
  add column tax_amount numeric(12,2) not null default 0;

-- Tax rules ---------------------------------------------------------------------------------------

-- The tax type that actually applies: D for everything when the store isn't VAT registered.
create or replace function public.effective_tax_type(p_type public.etims_tax_type)
returns public.etims_tax_type
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when coalesce((select vat_registered from public.store_settings), true) then p_type else 'D'::public.etims_tax_type end;
$$;

create or replace function public.tax_rate(p_type public.etims_tax_type)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select case public.effective_tax_type(p_type) when 'B' then 16 when 'E' then 8 else 0 end::numeric;
$$;
grant execute on function public.effective_tax_type(public.etims_tax_type) to anon, authenticated;
grant execute on function public.tax_rate(public.etims_tax_type) to anon, authenticated;

-- VAT rate of every active variant, for the till (works offline from this list) and the cart.
create or replace function public.variant_tax_rates()
returns table (variant_id uuid, tax_type public.etims_tax_type, tax_rate numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.id, public.effective_tax_type(p.tax_type), public.tax_rate(p.tax_type)
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.is_active;
$$;
grant execute on function public.variant_tax_rates() to anon, authenticated;

-- Applies VAT to an order from its lines, discount and delivery fee, and sets the total.
-- Called by place_order() and pos_complete_sale(); not callable from the API.
create or replace function public.apply_order_tax(p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_fee_tax numeric(12,2);
  v_total numeric(12,2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  update public.order_items oi
  set tax_type = t.tax_type, tax_rate = t.rate,
      discount_amount = t.line_discount,
      tax_amount = round((oi.line_total - t.line_discount) * t.rate / 100, 2)
  from (
    select i.id, public.effective_tax_type(p.tax_type) as tax_type, public.tax_rate(p.tax_type) as rate,
           case when v_order.subtotal > 0 then round(i.line_total * v_order.discount_amount / v_order.subtotal, 2) else 0 end as line_discount
    from public.order_items i join public.products p on p.id = i.product_id
    where i.order_id = p_order_id
  ) t
  where oi.id = t.id;

  v_fee_tax := round(v_order.delivery_amount * public.tax_rate('B') / 100, 2);
  select coalesce(sum(line_total - discount_amount), 0) + v_order.delivery_amount + coalesce(sum(tax_amount), 0) + v_fee_tax
    into v_total from public.order_items where order_id = p_order_id;
  update public.orders
  set discount_amount = (select coalesce(sum(discount_amount), 0) from public.order_items where order_id = p_order_id),
      tax_amount = (select coalesce(sum(tax_amount), 0) from public.order_items where order_id = p_order_id) + v_fee_tax,
      total_amount = v_total, updated_at = now()
  where id = p_order_id;
  return v_total;
end;
$$;
revoke execute on function public.apply_order_tax(uuid) from public, anon, authenticated;

-- Invoices --------------------------------------------------------------------------------------

create type public.invoice_kind as enum ('invoice', 'credit_note');
create type public.etims_status as enum ('pending', 'sent', 'failed');
create sequence public.invoice_number_seq start 1001;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  kind public.invoice_kind not null default 'invoice',
  invoice_number text not null unique,
  -- Cascade only so the demo reset can clear orders; real orders are never deleted.
  order_id uuid not null references public.orders(id) on delete cascade,
  original_invoice_id uuid references public.invoices(id) on delete cascade,
  issued_at timestamptz not null default now(),
  seller_name text not null,
  seller_kra_pin text,
  buyer_name text,
  buyer_phone text,
  buyer_kra_pin text,
  -- Snapshot of what was sold, so the invoice never changes if products or prices do.
  lines jsonb not null,
  tax_summary jsonb not null,
  subtotal numeric(12,2) not null,
  discount_amount numeric(12,2) not null,
  delivery_amount numeric(12,2) not null,
  tax_amount numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  -- KRA eTIMS: filled in only from KRA's reply once the connection is set up.
  etims_status public.etims_status not null default 'pending',
  etims_receipt_number text,
  etims_signature text,
  etims_internal_data text,
  etims_sent_at timestamptz,
  etims_error text,
  etims_attempts integer not null default 0,
  unique (order_id, kind)
);
create index invoices_issued_at_idx on public.invoices (issued_at desc);
create index invoices_etims_status_idx on public.invoices (etims_status) where etims_status <> 'sent';

alter table public.invoices enable row level security;
-- Staff see every invoice; a customer sees the invoices of their own orders. Invoices are only
-- written by issue_tax_documents() (security definer), never directly.
create policy "invoices read" on public.invoices for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));

create or replace function public.issue_tax_documents()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_store public.store_settings%rowtype;
  v_invoice public.invoices%rowtype;
  v_lines jsonb;
  v_summary jsonb;
  v_fee_tax numeric(12,2);
  v_buyer_pin text;
begin
  -- Only orders priced with VAT (from this migration on); older and seeded orders have no tax lines.
  if not exists (select 1 from public.order_items where order_id = new.id and tax_type is not null) then
    return new;
  end if;

  if new.payment_status = 'paid' and new.total_amount > 0
     and not exists (select 1 from public.invoices where order_id = new.id and kind = 'invoice') then
    select * into v_store from public.store_settings;
    select kra_pin into v_buyer_pin from public.profiles where id = new.customer_id;
    v_fee_tax := new.tax_amount - (select coalesce(sum(tax_amount), 0) from public.order_items where order_id = new.id);
    select jsonb_agg(jsonb_build_object(
             'name', product_name, 'sku', sku, 'quantity', quantity, 'unit_price', unit_price, 'amount', line_total,
             'discount', discount_amount, 'taxable', line_total - discount_amount, 'tax_type', tax_type, 'tax_rate', tax_rate,
             'tax', tax_amount, 'total', line_total - discount_amount + tax_amount) order by product_name)
      into v_lines from public.order_items where order_id = new.id;
    if new.delivery_amount > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'name', 'Delivery', 'sku', null, 'quantity', 1, 'unit_price', new.delivery_amount, 'amount', new.delivery_amount,
        'discount', 0, 'taxable', new.delivery_amount, 'tax_type', public.effective_tax_type('B'), 'tax_rate', public.tax_rate('B'),
        'tax', v_fee_tax, 'total', new.delivery_amount + v_fee_tax));
    end if;
    select jsonb_object_agg(t, jsonb_build_object('rate', rate, 'taxable', taxable, 'tax', tax))
      into v_summary
    from (select l->>'tax_type' as t, max((l->>'tax_rate')::numeric) as rate,
                 sum((l->>'taxable')::numeric) as taxable, sum((l->>'tax')::numeric) as tax
          from jsonb_array_elements(v_lines) l group by 1) s;
    insert into public.invoices (kind, invoice_number, order_id, seller_name, seller_kra_pin, buyer_name, buyer_phone, buyer_kra_pin,
                                 lines, tax_summary, subtotal, discount_amount, delivery_amount, tax_amount, total_amount)
    values ('invoice', 'INV-' || nextval('public.invoice_number_seq'), new.id, v_store.name, v_store.kra_pin,
            new.customer_name, new.customer_phone, v_buyer_pin, v_lines, coalesce(v_summary, '{}'),
            new.subtotal, new.discount_amount, new.delivery_amount, new.tax_amount, new.total_amount);
  end if;

  -- A refunded paid order gets a credit note against its invoice.
  if old.payment_status = 'paid' and new.payment_status = 'refunded'
     and not exists (select 1 from public.invoices where order_id = new.id and kind = 'credit_note') then
    select * into v_invoice from public.invoices where order_id = new.id and kind = 'invoice';
    if found then
      insert into public.invoices (kind, invoice_number, order_id, original_invoice_id, seller_name, seller_kra_pin, buyer_name,
                                   buyer_phone, buyer_kra_pin, lines, tax_summary, subtotal, discount_amount, delivery_amount,
                                   tax_amount, total_amount)
      values ('credit_note', 'CN-' || nextval('public.invoice_number_seq'), new.id, v_invoice.id, v_invoice.seller_name,
              v_invoice.seller_kra_pin, v_invoice.buyer_name, v_invoice.buyer_phone, v_invoice.buyer_kra_pin, v_invoice.lines,
              v_invoice.tax_summary, v_invoice.subtotal, v_invoice.discount_amount, v_invoice.delivery_amount,
              v_invoice.tax_amount, v_invoice.total_amount);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.issue_tax_documents() from public, anon, authenticated;

create trigger orders_issue_tax_documents
  after update of payment_status, total_amount on public.orders
  for each row execute function public.issue_tax_documents();

-- Pricing: quotes now carry each line's VAT rate ---------------------------------------------------

drop function public.quote_cart(jsonb);
drop function public.pos_quote(uuid, jsonb);
drop function public.price_cart(uuid, jsonb);

create or replace function public.price_cart(p_customer_id uuid, p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb, tax_rate numeric)
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
          from public.price_breaks(p_customer_id, array[i.variant_id]) b),
         (select public.tax_rate(p.tax_type) from public.product_variants v join public.products p on p.id = v.product_id
          where v.id = i.variant_id)
  from items i
  cross join lateral public.price_line(p_customer_id, i.variant_id, i.qty) pl;
$$;
revoke execute on function public.price_cart(uuid, jsonb) from public, anon, authenticated;

create or replace function public.quote_cart(p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb, tax_rate numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.price_cart(auth.uid(), p_items);
$$;
revoke execute on function public.quote_cart(jsonb) from public;
grant execute on function public.quote_cart(jsonb) to anon, authenticated;

create or replace function public.pos_quote(p_customer_id uuid, p_items jsonb)
returns table (variant_id uuid, quantity integer, unit_price numeric, retail_price numeric, rule text, line_total numeric,
               available integer, breaks jsonb, tax_rate numeric)
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

-- Orders: VAT added on top of the engine's prices ---------------------------------------------------

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
  v_total := public.apply_order_tax(v_order);  -- adds VAT on top (prices are VAT-exclusive)

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

create or replace function public.pos_complete_sale(
  p_customer_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_payments jsonb,
  p_client_ref text default null,
  p_offline_at timestamptz default null
)
returns table (order_id uuid, order_number text, total_amount numeric, change_due numeric, payments jsonb, duplicate boolean)
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
  v_customer public.profiles%rowtype;
  v_points integer;
  v_existing public.orders%rowtype;
  v_pay record;
  v_cash numeric(12,2) := 0;
  v_other numeric(12,2) := 0;
  v_change numeric(12,2);
  v_ref text;
  v_used text;
  v_recorded jsonb := '[]'::jsonb;
  v_summary text := '';
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
        (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount, 'reference', p.provider_reference) order by p.created_at), '[]')
         from public.payments p where p.order_id = v_existing.id), true;
      return;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Add a payment.';
  end if;
  if jsonb_array_length(p_payments) > 5 then
    raise exception 'A sale can be split into at most 5 payments.';
  end if;

  -- Validate the payments before touching stock.
  for v_pay in
    select e->>'method' as method, round((e->>'amount')::numeric, 2) as amount,
           nullif(btrim(e->>'reference'), '') as reference
    from jsonb_array_elements(p_payments) e
  loop
    if v_pay.method is null or v_pay.method not in ('cash', 'mpesa', 'card', 'bank_transfer') then
      raise exception 'Choose cash, M-Pesa, card or bank transfer for each payment.';
    end if;
    if v_pay.amount is null or v_pay.amount <= 0 then
      raise exception 'Enter an amount for each payment.';
    end if;
    if p_offline_at is not null and v_pay.method <> 'cash' then
      raise exception 'Only cash sales can be taken offline.';
    end if;
    if v_pay.method = 'mpesa' and v_pay.reference is not null then
      if upper(v_pay.reference) !~ '^[A-Z0-9]{8,12}$' then
        raise exception 'The M-Pesa code % doesn''t look right. It is 10 letters and numbers, e.g. SGH7K2LMQP.', v_pay.reference;
      end if;
      select o.order_number into v_used from public.payments p join public.orders o on o.id = p.order_id
      where p.method = 'mpesa' and upper(p.provider_reference) = upper(v_pay.reference) and p.status = 'paid' limit 1;
      if found then
        raise exception 'M-Pesa code % was already used on order %.', upper(v_pay.reference), v_used;
      end if;
    end if;
    if length(coalesce(v_pay.reference, '')) > 40 then
      raise exception 'Payment references can be at most 40 characters.';
    end if;
    if v_pay.method = 'cash' then v_cash := v_cash + v_pay.amount; else v_other := v_other + v_pay.amount; end if;
  end loop;

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
  -- Total with VAT on top (prices are VAT-exclusive); payments must cover it.
  update public.orders set subtotal = v_sub, discount_amount = v_disc where id = v_order;
  v_total := public.apply_order_tax(v_order);
  if v_other > v_total then
    raise exception 'M-Pesa, card and bank payments (KES %) add up to more than the total (KES %).',
      to_char(v_other, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00');
  end if;
  if v_cash + v_other < v_total then
    raise exception 'KES % is still to pay. Payments add up to KES % of KES %.',
      to_char(v_total - v_cash - v_other, 'FM999,999,990.00'), to_char(v_cash + v_other, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00');
  end if;
  v_change := v_cash + v_other - v_total;  -- never more than the cash, since the rest is at most the total

  for v_pay in
    select e->>'method' as method, round((e->>'amount')::numeric, 2) as amount,
           nullif(btrim(e->>'reference'), '') as reference, nullif(btrim(e->>'phone'), '') as phone
    from jsonb_array_elements(p_payments) e
    where e->>'method' <> 'cash'
  loop
    v_ref := case v_pay.method
      when 'mpesa' then coalesce(upper(v_pay.reference), public.mpesa_reference())
      when 'card' then coalesce(v_pay.reference, 'CARD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)))
      else coalesce(v_pay.reference, 'BANK-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))) end;
    insert into public.payments (order_id, method, status, amount, provider_reference, paid_at)
    values (v_order, v_pay.method::public.payment_method, 'paid', v_pay.amount, v_ref, now());
    v_recorded := v_recorded || jsonb_build_object('method', v_pay.method, 'amount', v_pay.amount, 'reference', v_ref);
    v_summary := v_summary || case when v_summary = '' then '' else ' + ' end
      || case v_pay.method when 'mpesa' then 'M-Pesa' when 'card' then 'card' else 'bank transfer' end
      || ' KES ' || to_char(v_pay.amount, 'FM999,999,990.00') || coalesce(' (' || v_pay.phone || ')', '');
  end loop;
  if v_cash - v_change > 0 then
    v_ref := 'CASH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into public.payments (order_id, method, status, amount, provider_reference, paid_at)
    values (v_order, 'cash', 'paid', v_cash - v_change, v_ref, coalesce(p_offline_at, now()));
    v_recorded := jsonb_build_object('method', 'cash', 'amount', v_cash - v_change, 'reference', v_ref) || v_recorded;
    v_summary := 'cash KES ' || to_char(v_cash - v_change, 'FM999,999,990.00') || case when v_summary = '' then '' else ' + ' end || v_summary;
  end if;

  insert into public.order_events (order_id, status, note, created_by)
  values (v_order, 'completed', 'In-store sale (' || v_tier.name || '), paid by ' || v_summary
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
          'offline', p_offline_at is not null, 'payments', v_recorded));
  perform public.notify_customer(v_order, 'Thank you for shopping at Sparkle',
    'Your in-store purchase ' || v_number || ' of KES ' || to_char(v_total, 'FM999,999') || ' is complete.');

  return query select v_order, v_number, v_total, v_change, v_recorded, false;
end;
$$;
revoke execute on function public.pos_complete_sale(uuid, jsonb, numeric, jsonb, text, timestamptz) from public, anon;
grant execute on function public.pos_complete_sale(uuid, jsonb, numeric, jsonb, text, timestamptz) to authenticated;
