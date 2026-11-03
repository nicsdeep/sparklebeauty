-- Indexes on foreign-key columns that had none (found in the system check, 2026-11-02).
-- Without them, looking up an order's items or payments, a customer's loyalty history, or
-- deleting a referenced row scans the whole table. Harmless at today's size; this keeps pages
-- fast as orders grow. The tables are small, so building them here (in the migration's
-- transaction) takes moments.

create index if not exists inventory_levels_location_id_idx on public.inventory_levels (location_id);
create index if not exists categories_parent_id_idx on public.categories (parent_id);
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
create index if not exists product_prices_tier_id_idx on public.product_prices (tier_id);
create index if not exists customer_addresses_user_id_idx on public.customer_addresses (user_id);
create index if not exists orders_pricing_tier_id_idx on public.orders (pricing_tier_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists stock_movements_location_id_idx on public.stock_movements (location_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements (created_by);
create index if not exists wishlist_items_product_id_idx on public.wishlist_items (product_id);
create index if not exists loyalty_transactions_customer_id_idx on public.loyalty_transactions (customer_id);
create index if not exists loyalty_transactions_order_id_idx on public.loyalty_transactions (order_id);
create index if not exists customer_notes_customer_id_idx on public.customer_notes (customer_id);
create index if not exists customer_notes_created_by_idx on public.customer_notes (created_by);
create index if not exists orders_promotion_id_idx on public.orders (promotion_id);
create index if not exists orders_created_by_idx on public.orders (created_by);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists order_events_created_by_idx on public.order_events (created_by);
create index if not exists wholesale_accounts_pricing_tier_id_idx on public.wholesale_accounts (pricing_tier_id);
create index if not exists activity_log_actor_id_idx on public.activity_log (actor_id);
create index if not exists store_settings_updated_by_idx on public.store_settings (updated_by);
create index if not exists hero_banners_updated_by_idx on public.hero_banners (updated_by);
create index if not exists customer_prices_created_by_idx on public.customer_prices (created_by);
create index if not exists invoices_original_invoice_id_idx on public.invoices (original_invoice_id);
