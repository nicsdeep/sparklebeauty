-- Fixes the three known issues from the baseline review:
--   1. Customers couldn't see stock: add get_variant_stock(), which returns
--      availability for active variants without exposing inventory_levels itself.
--   2. anon/authenticated could execute the SECURITY DEFINER helpers: revoke where
--      not needed. Policies that call is_admin() now apply only to `authenticated`,
--      so anon no longer needs it.
--   3. RLS performance warnings: auth.uid()/is_admin() are wrapped in (select ...)
--      so they're evaluated once per query, and each table now has at most one
--      permissive policy per role and action.
-- Access is unchanged except for the new stock function: same people can read and
-- write the same rows as before.

-- 1. Stock availability for the storefront ----------------------------------------

create or replace function public.get_variant_stock(p_variant_ids uuid[])
returns table (variant_id uuid, quantity_available integer, in_stock boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.id,
         coalesce(sum(l.quantity) filter (where loc.is_active), 0)::integer,
         coalesce(sum(l.quantity) filter (where loc.is_active), 0) > 0
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_levels l on l.variant_id = v.id
  left join public.inventory_locations loc on loc.id = l.location_id
  where v.id = any(p_variant_ids)
    and v.is_active
    and p.is_active
  group by v.id;
$$;

revoke execute on function public.get_variant_stock(uuid[]) from public;
grant execute on function public.get_variant_stock(uuid[]) to anon, authenticated;

-- 2. SECURITY DEFINER helper privileges -------------------------------------------

-- Trigger functions are never called directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;

-- Role checks are only needed by signed-in users' policies and the profile guard.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_role_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_role_admin() to authenticated;

-- 3. Policies: rebuilt with (select ...) wrappers and no overlapping permissive policies

-- Catalogue tables: anyone reads active rows, staff read everything and write.
drop policy if exists "public brands read" on public.brands;
drop policy if exists "staff brands" on public.brands;
create policy "brands read (anon)" on public.brands for select to anon using (is_active);
create policy "brands read" on public.brands for select to authenticated using (is_active or (select public.is_admin()));
create policy "brands insert (staff)" on public.brands for insert to authenticated with check ((select public.is_admin()));
create policy "brands update (staff)" on public.brands for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "brands delete (staff)" on public.brands for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public catalog read" on public.categories;
drop policy if exists "staff categories" on public.categories;
create policy "categories read (anon)" on public.categories for select to anon using (is_active);
create policy "categories read" on public.categories for select to authenticated using (is_active or (select public.is_admin()));
create policy "categories insert (staff)" on public.categories for insert to authenticated with check ((select public.is_admin()));
create policy "categories update (staff)" on public.categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories delete (staff)" on public.categories for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public products read" on public.products;
drop policy if exists "staff products" on public.products;
create policy "products read (anon)" on public.products for select to anon using (is_active);
create policy "products read" on public.products for select to authenticated using (is_active or (select public.is_admin()));
create policy "products insert (staff)" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products update (staff)" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products delete (staff)" on public.products for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public variants read" on public.product_variants;
drop policy if exists "staff variants" on public.product_variants;
create policy "variants read (anon)" on public.product_variants for select to anon using (is_active);
create policy "variants read" on public.product_variants for select to authenticated using (is_active or (select public.is_admin()));
create policy "variants insert (staff)" on public.product_variants for insert to authenticated with check ((select public.is_admin()));
create policy "variants update (staff)" on public.product_variants for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "variants delete (staff)" on public.product_variants for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public prices read" on public.product_prices;
drop policy if exists "staff prices" on public.product_prices;
create policy "prices read" on public.product_prices for select to anon, authenticated using (true);
create policy "prices insert (staff)" on public.product_prices for insert to authenticated with check ((select public.is_admin()));
create policy "prices update (staff)" on public.product_prices for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "prices delete (staff)" on public.product_prices for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public promotion read" on public.promotions;
drop policy if exists "staff promotions" on public.promotions;
create policy "promotions read (anon)" on public.promotions for select to anon
  using (is_active and (ends_at is null or ends_at > now()));
create policy "promotions read" on public.promotions for select to authenticated
  using ((is_active and (ends_at is null or ends_at > now())) or (select public.is_admin()));
create policy "promotions insert (staff)" on public.promotions for insert to authenticated with check ((select public.is_admin()));
create policy "promotions update (staff)" on public.promotions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "promotions delete (staff)" on public.promotions for delete to authenticated using ((select public.is_admin()));

-- Staff-only tables: one policy covering every action.
drop policy if exists "staff customer notes" on public.customer_notes;
create policy "customer notes (staff)" on public.customer_notes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "staff inventory" on public.inventory_levels;
create policy "inventory levels (staff)" on public.inventory_levels for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "staff locations" on public.inventory_locations;
create policy "inventory locations (staff)" on public.inventory_locations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "staff tiers" on public.pricing_tiers;
create policy "pricing tiers (staff)" on public.pricing_tiers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "staff stock movements" on public.stock_movements;
create policy "stock movements (staff)" on public.stock_movements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Customer-owned rows that staff can also manage.
drop policy if exists "admin full access profiles" on public.profiles;
drop policy if exists "customer read own profile" on public.profiles;
drop policy if exists "customer update own profile" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles insert (staff)" on public.profiles for insert to authenticated with check ((select public.is_admin()));
create policy "profiles delete (staff)" on public.profiles for delete to authenticated using ((select public.is_admin()));

drop policy if exists "customer addresses own" on public.customer_addresses;
drop policy if exists "staff customers addresses" on public.customer_addresses;
create policy "addresses read" on public.customer_addresses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "addresses insert (own)" on public.customer_addresses for insert to authenticated with check (user_id = (select auth.uid()));
create policy "addresses update (own)" on public.customer_addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "addresses delete (own)" on public.customer_addresses for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "customer loyalty own" on public.loyalty_transactions;
drop policy if exists "staff loyalty" on public.loyalty_transactions;
create policy "loyalty read" on public.loyalty_transactions for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "loyalty insert (staff)" on public.loyalty_transactions for insert to authenticated with check ((select public.is_admin()));
create policy "loyalty update (staff)" on public.loyalty_transactions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "loyalty delete (staff)" on public.loyalty_transactions for delete to authenticated using ((select public.is_admin()));

drop policy if exists "customer orders own" on public.orders;
drop policy if exists "staff orders" on public.orders;
create policy "orders read" on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders insert (staff)" on public.orders for insert to authenticated with check ((select public.is_admin()));
create policy "orders update (staff)" on public.orders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "orders delete (staff)" on public.orders for delete to authenticated using ((select public.is_admin()));

drop policy if exists "customer order items own" on public.order_items;
drop policy if exists "staff order items" on public.order_items;
create policy "order items read" on public.order_items for select to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.orders o where o.id = order_items.order_id and o.customer_id = (select auth.uid())));
create policy "order items insert (staff)" on public.order_items for insert to authenticated with check ((select public.is_admin()));
create policy "order items update (staff)" on public.order_items for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order items delete (staff)" on public.order_items for delete to authenticated using ((select public.is_admin()));

drop policy if exists "customer payments own" on public.payments;
drop policy if exists "staff payments" on public.payments;
create policy "payments read" on public.payments for select to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.orders o where o.id = payments.order_id and o.customer_id = (select auth.uid())));
create policy "payments insert (staff)" on public.payments for insert to authenticated with check ((select public.is_admin()));
create policy "payments update (staff)" on public.payments for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "payments delete (staff)" on public.payments for delete to authenticated using ((select public.is_admin()));

-- Customer-only rows.
drop policy if exists "customer wishlist own" on public.wishlists;
create policy "wishlist (own)" on public.wishlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "customer wishlist items own" on public.wishlist_items;
create policy "wishlist items (own)" on public.wishlist_items for all to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_items.wishlist_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_items.wishlist_id and w.user_id = (select auth.uid())));
