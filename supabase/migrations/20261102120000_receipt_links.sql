-- Private receipt links: the till sends customers a WhatsApp message with a link that opens their
-- receipt and lets them download it as a PDF, without signing in (walk-in customers have no
-- account). The link carries a random token, one per order, that can't be guessed.

alter table public.orders add column receipt_token uuid not null default gen_random_uuid();
create unique index orders_receipt_token_key on public.orders (receipt_token);

-- The receipt for a token, only for orders that were paid (or refunded); null otherwise.
-- Returns just what the receipt shows.
create or replace function public.public_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'number', o.order_number,
    'issued_at', o.created_at,
    'cashier', (select full_name from public.profiles where id = o.created_by),
    'channel', case when o.created_by is null then 'online' else 'till' end,
    'customer', coalesce(o.customer_name, 'Walk-in customer'),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('quantity', i.quantity, 'name', i.product_name, 'sku', i.sku,
                'amount', i.line_total - i.discount_amount + i.tax_amount, 'tax_rate', i.tax_rate) order by i.product_name), '[]')
              from public.order_items i where i.order_id = o.id),
    'subtotal', o.subtotal, 'discount', o.discount_amount, 'delivery', o.delivery_amount, 'tax', o.tax_amount, 'total', o.total_amount,
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount, 'reference', p.provider_reference) order by p.created_at), '[]')
                 from public.payments p where p.order_id = o.id and p.status in ('paid', 'refunded')),
    'invoice_number', (select v.invoice_number from public.invoices v where v.order_id = o.id and v.kind = 'invoice'))
  from public.orders o
  where o.receipt_token = p_token and o.payment_status in ('paid', 'refunded', 'partially_refunded');
$$;
revoke execute on function public.public_receipt(uuid) from public;
grant execute on function public.public_receipt(uuid) to anon, authenticated;
