-- Invoices issued before the shop's KRA PIN was saved (e.g. INV-1001) printed "Not set".
-- The seller is the same business, so those invoices take the PIN from Settings, as long as
-- they haven't been sent to KRA eTIMS (a transmitted invoice never changes). From now on,
-- saving the PIN in Settings also fills it on any such waiting invoice.

create or replace function public.fill_invoice_seller_pin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.invoices set seller_kra_pin = new.kra_pin
  where seller_kra_pin is null and etims_status <> 'sent';
  return new;
end;
$$;
revoke execute on function public.fill_invoice_seller_pin() from public, anon, authenticated;

create trigger store_settings_fill_invoice_pin
  after update of kra_pin on public.store_settings
  for each row when (new.kra_pin is not null)
  execute function public.fill_invoice_seller_pin();

update public.invoices set seller_kra_pin = (select kra_pin from public.store_settings)
where seller_kra_pin is null and etims_status <> 'sent' and (select kra_pin from public.store_settings) is not null;
