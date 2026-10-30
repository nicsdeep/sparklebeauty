-- POS split payments: one sale can be paid with several methods, e.g. KES 350 cash and the
-- KES 150 balance by M-Pesa, card or bank transfer, all at the till.
--
-- pos_complete_sale now takes p_payments, a list of {method, amount, phone?, reference?}:
--   - cash: amount is the cash received; any change comes out of the cash.
--   - mpesa / card / bank_transfer: amount is what is charged to that method. Together they can't
--     exceed the total (there is no change on M-Pesa, card or bank).
--   - reference: the M-Pesa code, card slip or bank reference the customer shows. An M-Pesa code
--     can only be used once. Without one, M-Pesa is the simulated STK push (see PROJECT_STATE).
-- Each method is recorded as its own row in payments (cash as one row, net of change).
-- Offline sales stay cash only.

drop function public.pos_complete_sale(uuid, jsonb, numeric, public.payment_method, numeric, text, text, timestamptz);

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
  v_total := v_sub - v_disc;
  if v_other > v_total then
    raise exception 'M-Pesa, card and bank payments (KES %) add up to more than the total (KES %).',
      to_char(v_other, 'FM999,999,990'), to_char(v_total, 'FM999,999,990');
  end if;
  if v_cash + v_other < v_total then
    raise exception 'KES % is still to pay. Payments add up to KES % of KES %.',
      to_char(v_total - v_cash - v_other, 'FM999,999,990'), to_char(v_cash + v_other, 'FM999,999,990'), to_char(v_total, 'FM999,999,990');
  end if;
  v_change := v_cash + v_other - v_total;  -- never more than the cash, since the rest is at most the total

  update public.orders set subtotal = v_sub, discount_amount = v_disc, total_amount = v_total where id = v_order;

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
      || ' KES ' || to_char(v_pay.amount, 'FM999,999,990') || coalesce(' (' || v_pay.phone || ')', '');
  end loop;
  if v_cash - v_change > 0 then
    v_ref := 'CASH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into public.payments (order_id, method, status, amount, provider_reference, paid_at)
    values (v_order, 'cash', 'paid', v_cash - v_change, v_ref, coalesce(p_offline_at, now()));
    v_recorded := jsonb_build_object('method', 'cash', 'amount', v_cash - v_change, 'reference', v_ref) || v_recorded;
    v_summary := 'cash KES ' || to_char(v_cash - v_change, 'FM999,999,990') || case when v_summary = '' then '' else ' + ' end || v_summary;
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
