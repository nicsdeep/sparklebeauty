-- Order lifecycle for the O2C demo: New -> Confirmed -> Paid -> Processing -> Packed
-- -> Dispatched -> Delivered -> Completed. 'pending' is shown as "New".
-- Enum values must be committed before functions can use them, hence a separate migration.
alter type public.order_status add value if not exists 'paid' after 'confirmed';
alter type public.order_status add value if not exists 'packed' after 'processing';
alter type public.order_status add value if not exists 'dispatched' after 'packed';
alter type public.order_status add value if not exists 'delivered' after 'dispatched';
