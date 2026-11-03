-- Order tracking: an estimated delivery time staff set when they dispatch, and live updates for
-- the customer's tracking page.

-- When staff expect the order to arrive (set at dispatch, can be changed). Null = no estimate.
alter table public.orders add column estimated_delivery_at timestamptz;

-- Staff set or clear the estimate.
create or replace function public.set_delivery_estimate(p_order_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only staff can update orders.' using errcode = '42501';
  end if;
  update public.orders set estimated_delivery_at = p_at where id = p_order_id;
  if not found then
    raise exception 'Order not found.';
  end if;
end;
$$;
revoke execute on function public.set_delivery_estimate(uuid, timestamptz) from public, anon;
grant execute on function public.set_delivery_estimate(uuid, timestamptz) to authenticated;

-- Private topic per order ("order:<id>"): tells the customer's open tracking page that the
-- status, payment or estimate changed (the page then re-reads the order).
create or replace function public.broadcast_order_customer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform realtime.send(jsonb_build_object('status', new.status), 'order', 'order:' || new.id, true);
  return null;
end;
$$;
revoke execute on function public.broadcast_order_customer() from public, anon, authenticated;
create trigger orders_broadcast_customer
  after update of status, payment_status, estimated_delivery_at on public.orders
  for each row execute function public.broadcast_order_customer();

-- Only the order's customer (and staff) may receive its topic.
create policy "customers receive their order updates" on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'order:%'
    and exists (
      select 1 from public.orders o
      where o.id::text = substr(realtime.topic(), 7)
        and (o.customer_id = (select auth.uid()) or (select public.is_admin()))
    )
  );
