-- WhatsApp contacts: a labelled list (e.g. Support, Sales, Admin) instead of one number, so the
-- chat button can let customers choose who to message. The first contact is the main one, shown
-- on invoices, the contact page and the footer.
--
-- Nicholas (2026-10-31): the main WhatsApp number is Maureen's (0702 388 724, already in the shop
-- phone list), not his own (0727 939 626), which is removed. More contacts are added in Settings.

alter table public.store_settings
  add column whatsapp_contacts jsonb not null default '[]'
    check (jsonb_typeof(whatsapp_contacts) = 'array' and jsonb_array_length(whatsapp_contacts) <= 8);

update public.store_settings
set whatsapp_contacts = '[{"label": "Support", "number": "0702 388 724"}]'::jsonb;

alter table public.store_settings drop column whatsapp;
