-- Prices include VAT (Nicholas, 2026-11-11): Sparkle's shelf prices are VAT-inclusive, so the
-- customer pays exactly the price shown. VAT is no longer added on top; it is worked out from
-- inside each price, per line, with the product's eTIMS tax type:
--   line discount = round(line_total * order_discount / subtotal, 2)      (unchanged)
--   line amount   = line_total - line discount                             (what the customer pays)
--   line VAT      = round(line amount * rate / (100 + rate), 2)
--   delivery VAT  = round(delivery_fee * rate(B) / (100 + rate(B)), 2)
--   total         = sum(line amount) + delivery_fee
-- lib/tax.ts must match this to the cent.
--
-- Orders and invoices made before this change were priced with VAT on top. They keep their amounts
-- and are marked prices_include_vat = false, so receipts and invoices still show them correctly.

alter table public.orders add column prices_include_vat boolean not null default true;
update public.orders set prices_include_vat = false;

alter table public.invoices add column prices_include_vat boolean not null default true;
update public.invoices set prices_include_vat = false;

create or replace function public.apply_order_tax(p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_fee_rate numeric := public.tax_rate('B');
  v_fee_tax numeric(12,2);
  v_total numeric(12,2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  update public.order_items oi
  set tax_type = t.tax_type, tax_rate = t.rate,
      discount_amount = t.line_discount,
      tax_amount = case when v_order.prices_include_vat
                        then round((oi.line_total - t.line_discount) * t.rate / (100 + t.rate), 2)
                        else round((oi.line_total - t.line_discount) * t.rate / 100, 2) end
  from (
    select i.id, public.effective_tax_type(p.tax_type) as tax_type, public.tax_rate(p.tax_type) as rate,
           case when v_order.subtotal > 0 then round(i.line_total * v_order.discount_amount / v_order.subtotal, 2) else 0 end as line_discount
    from public.order_items i join public.products p on p.id = i.product_id
    where i.order_id = p_order_id
  ) t
  where oi.id = t.id;

  if v_order.prices_include_vat then
    v_fee_tax := round(v_order.delivery_amount * v_fee_rate / (100 + v_fee_rate), 2);
    select coalesce(sum(line_total - discount_amount), 0) + v_order.delivery_amount
      into v_total from public.order_items where order_id = p_order_id;
  else
    v_fee_tax := round(v_order.delivery_amount * v_fee_rate / 100, 2);
    select coalesce(sum(line_total - discount_amount), 0) + v_order.delivery_amount + coalesce(sum(tax_amount), 0) + v_fee_tax
      into v_total from public.order_items where order_id = p_order_id;
  end if;

  update public.orders
  set discount_amount = (select coalesce(sum(discount_amount), 0) from public.order_items where order_id = p_order_id),
      tax_amount = (select coalesce(sum(tax_amount), 0) from public.order_items where order_id = p_order_id) + v_fee_tax,
      total_amount = v_total, updated_at = now()
  where id = p_order_id;
  return v_total;
end;
$$;
revoke execute on function public.apply_order_tax(uuid) from public, anon, authenticated;

-- Tax invoices: for VAT-inclusive orders the taxable value is the amount less the VAT inside it,
-- and each line's total is what the customer paid.
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
  v_incl boolean := new.prices_include_vat;
begin
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
             'discount', discount_amount,
             'taxable', case when v_incl then line_total - discount_amount - tax_amount else line_total - discount_amount end,
             'tax_type', tax_type, 'tax_rate', tax_rate, 'tax', tax_amount,
             'total', case when v_incl then line_total - discount_amount else line_total - discount_amount + tax_amount end)
             order by product_name)
      into v_lines from public.order_items where order_id = new.id;
    if new.delivery_amount > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'name', 'Delivery', 'sku', null, 'quantity', 1, 'unit_price', new.delivery_amount, 'amount', new.delivery_amount, 'discount', 0,
        'taxable', case when v_incl then new.delivery_amount - v_fee_tax else new.delivery_amount end,
        'tax_type', public.effective_tax_type('B'), 'tax_rate', public.tax_rate('B'), 'tax', v_fee_tax,
        'total', case when v_incl then new.delivery_amount else new.delivery_amount + v_fee_tax end));
    end if;
    select jsonb_object_agg(t, jsonb_build_object('rate', rate, 'taxable', taxable, 'tax', tax))
      into v_summary
    from (select l->>'tax_type' as t, max((l->>'tax_rate')::numeric) as rate,
                 sum((l->>'taxable')::numeric) as taxable, sum((l->>'tax')::numeric) as tax
          from jsonb_array_elements(v_lines) l group by 1) s;
    insert into public.invoices (kind, invoice_number, order_id, seller_name, seller_kra_pin, buyer_name, buyer_phone, buyer_kra_pin,
                                 lines, tax_summary, subtotal, discount_amount, delivery_amount, tax_amount, total_amount, prices_include_vat)
    values ('invoice', 'INV-' || nextval('public.invoice_number_seq'), new.id, v_store.name, v_store.kra_pin,
            new.customer_name, new.customer_phone, v_buyer_pin, v_lines, coalesce(v_summary, '{}'),
            new.subtotal, new.discount_amount, new.delivery_amount, new.tax_amount, new.total_amount, v_incl);
  end if;

  if old.payment_status = 'paid' and new.payment_status = 'refunded'
     and not exists (select 1 from public.invoices where order_id = new.id and kind = 'credit_note') then
    select * into v_invoice from public.invoices where order_id = new.id and kind = 'invoice';
    if found then
      insert into public.invoices (kind, invoice_number, order_id, original_invoice_id, seller_name, seller_kra_pin, buyer_name,
                                   buyer_phone, buyer_kra_pin, lines, tax_summary, subtotal, discount_amount, delivery_amount,
                                   tax_amount, total_amount, prices_include_vat)
      values ('credit_note', 'CN-' || nextval('public.invoice_number_seq'), new.id, v_invoice.id, v_invoice.seller_name,
              v_invoice.seller_kra_pin, v_invoice.buyer_name, v_invoice.buyer_phone, v_invoice.buyer_kra_pin, v_invoice.lines,
              v_invoice.tax_summary, v_invoice.subtotal, v_invoice.discount_amount, v_invoice.delivery_amount,
              v_invoice.tax_amount, v_invoice.total_amount, v_invoice.prices_include_vat);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.issue_tax_documents() from public, anon, authenticated;

-- Public receipt: each line's amount is what the customer paid for it; the flag tells the page how to label VAT.
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
                'amount', i.line_total - i.discount_amount + case when o.prices_include_vat then 0 else i.tax_amount end,
                'tax_rate', i.tax_rate) order by i.product_name), '[]')
              from public.order_items i where i.order_id = o.id),
    'subtotal', o.subtotal, 'discount', o.discount_amount, 'delivery', o.delivery_amount, 'tax', o.tax_amount, 'total', o.total_amount,
    'prices_include_vat', o.prices_include_vat,
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount, 'reference', p.provider_reference) order by p.created_at), '[]')
                 from public.payments p where p.order_id = o.id and p.status in ('paid', 'refunded')),
    'invoice_number', (select v.invoice_number from public.invoices v where v.order_id = o.id and v.kind = 'invoice'))
  from public.orders o
  where o.receipt_token = p_token and o.payment_status in ('paid', 'refunded', 'partially_refunded');
$$;
revoke execute on function public.public_receipt(uuid) from public;
grant execute on function public.public_receipt(uuid) to anon, authenticated;
