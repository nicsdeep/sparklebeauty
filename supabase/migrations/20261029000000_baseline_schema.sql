-- Baseline: schema of the live sparkle-beauty database (public schema plus the auth.users sign-up trigger),
-- captured 2026-10-29 from the system catalog. These objects were created before migrations were tracked.

create type public.app_role as enum ('customer', 'staff', 'admin');

create type public.order_status as enum ('pending', 'confirmed', 'processing', 'ready_for_delivery', 'out_for_delivery', 'completed', 'cancelled', 'refunded');

create type public.payment_method as enum ('mpesa', 'cash', 'card', 'bank_transfer', 'other');

create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

create type public.price_type as enum ('retail', 'wholesale', 'special');

create type public.sales_channel as enum ('online', 'pos');

create type public.stock_movement_type as enum ('purchase', 'sale', 'adjustment', 'return', 'transfer', 'reservation', 'release');

create table public.brands (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  logo_url text,
  description text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  parent_id uuid,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.customer_addresses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  label text default 'Home'::text not null,
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  county text,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.customer_notes (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  note text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.inventory_levels (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null,
  location_id uuid not null,
  quantity integer default 0 not null,
  reorder_level integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.inventory_locations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  location_type text default 'store'::text not null,
  address text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table public.loyalty_transactions (
  id uuid default gen_random_uuid() not null,
  customer_id uuid not null,
  order_id uuid,
  points integer not null,
  reason text not null,
  created_at timestamp with time zone default now() not null
);

create table public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  variant_id uuid,
  product_name text not null,
  sku text,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  discount_amount numeric(12,2) default 0 not null,
  line_total numeric(12,2) not null
);

create table public.orders (
  id uuid default gen_random_uuid() not null,
  order_number text not null,
  customer_id uuid,
  channel sales_channel default 'online'::sales_channel not null,
  status order_status default 'pending'::order_status not null,
  payment_status payment_status default 'pending'::payment_status not null,
  pricing_tier_id uuid,
  shipping_address jsonb,
  subtotal numeric(12,2) default 0 not null,
  discount_amount numeric(12,2) default 0 not null,
  delivery_amount numeric(12,2) default 0 not null,
  total_amount numeric(12,2) default 0 not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  method payment_method not null,
  status payment_status default 'pending'::payment_status not null,
  amount numeric(12,2) not null,
  provider_reference text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.pricing_tiers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  code text not null,
  min_order_quantity integer default 1 not null,
  is_wholesale boolean default false not null,
  is_active boolean default true not null
);

create table public.product_prices (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null,
  tier_id uuid not null,
  amount numeric(12,2) not null,
  compare_at_amount numeric(12,2),
  currency text default 'KES'::text not null
);

create table public.product_variants (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  sku text not null,
  barcode text,
  name text,
  color text,
  shade text,
  size text,
  hair_length text,
  hair_texture text,
  hair_type text,
  hair_style text,
  image_url text,
  cost_price numeric(12,2),
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table public.products (
  id uuid default gen_random_uuid() not null,
  category_id uuid,
  brand_id uuid,
  name text not null,
  slug text not null,
  description text,
  image_urls text[] default '{}'::text[] not null,
  rating numeric(2,1) default 0 not null,
  review_count integer default 0 not null,
  is_active boolean default true not null,
  is_featured boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  role app_role default 'customer'::app_role not null,
  full_name text,
  phone text,
  avatar_url text,
  marketing_consent boolean default false not null,
  loyalty_points integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.promotions (
  id uuid default gen_random_uuid() not null,
  name text not null,
  code text,
  description text,
  discount_type text not null,
  discount_value numeric(12,2) not null,
  starts_at timestamp with time zone default now() not null,
  ends_at timestamp with time zone,
  minimum_order_amount numeric(12,2) default 0 not null,
  is_active boolean default true not null
);

create table public.stock_movements (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null,
  location_id uuid,
  movement_type stock_movement_type not null,
  quantity_change integer not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.wishlist_items (
  wishlist_id uuid not null,
  product_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.wishlists (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

alter table public.brands add constraint brands_name_key UNIQUE (name);

alter table public.brands add constraint brands_pkey PRIMARY KEY (id);

alter table public.brands add constraint brands_slug_key UNIQUE (slug);

alter table public.categories add constraint categories_name_key UNIQUE (name);

alter table public.categories add constraint categories_pkey PRIMARY KEY (id);

alter table public.categories add constraint categories_slug_key UNIQUE (slug);

alter table public.customer_addresses add constraint customer_addresses_pkey PRIMARY KEY (id);

alter table public.customer_notes add constraint customer_notes_pkey PRIMARY KEY (id);

alter table public.inventory_levels add constraint inventory_levels_pkey PRIMARY KEY (id);

alter table public.inventory_levels add constraint inventory_levels_quantity_check CHECK ((quantity >= 0));

alter table public.inventory_levels add constraint inventory_levels_reorder_level_check CHECK ((reorder_level >= 0));

alter table public.inventory_levels add constraint inventory_levels_variant_id_location_id_key UNIQUE (variant_id, location_id);

alter table public.inventory_locations add constraint inventory_locations_name_key UNIQUE (name);

alter table public.inventory_locations add constraint inventory_locations_pkey PRIMARY KEY (id);

alter table public.loyalty_transactions add constraint loyalty_transactions_pkey PRIMARY KEY (id);

alter table public.order_items add constraint order_items_line_total_check CHECK ((line_total >= (0)::numeric));

alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);

alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));

alter table public.order_items add constraint order_items_unit_price_check CHECK ((unit_price >= (0)::numeric));

alter table public.orders add constraint orders_order_number_key UNIQUE (order_number);

alter table public.orders add constraint orders_pkey PRIMARY KEY (id);

alter table public.payments add constraint payments_amount_check CHECK ((amount >= (0)::numeric));

alter table public.payments add constraint payments_pkey PRIMARY KEY (id);

alter table public.pricing_tiers add constraint pricing_tiers_code_key UNIQUE (code);

alter table public.pricing_tiers add constraint pricing_tiers_min_order_quantity_check CHECK ((min_order_quantity > 0));

alter table public.pricing_tiers add constraint pricing_tiers_name_key UNIQUE (name);

alter table public.pricing_tiers add constraint pricing_tiers_pkey PRIMARY KEY (id);

alter table public.product_prices add constraint product_prices_amount_check CHECK ((amount >= (0)::numeric));

alter table public.product_prices add constraint product_prices_compare_at_amount_check CHECK ((compare_at_amount >= (0)::numeric));

alter table public.product_prices add constraint product_prices_pkey PRIMARY KEY (id);

alter table public.product_prices add constraint product_prices_variant_id_tier_id_key UNIQUE (variant_id, tier_id);

alter table public.product_variants add constraint product_variants_barcode_key UNIQUE (barcode);

alter table public.product_variants add constraint product_variants_cost_price_check CHECK ((cost_price >= (0)::numeric));

alter table public.product_variants add constraint product_variants_pkey PRIMARY KEY (id);

alter table public.product_variants add constraint product_variants_sku_key UNIQUE (sku);

alter table public.products add constraint products_pkey PRIMARY KEY (id);

alter table public.products add constraint products_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)));

alter table public.products add constraint products_review_count_check CHECK ((review_count >= 0));

alter table public.products add constraint products_slug_key UNIQUE (slug);

alter table public.profiles add constraint profiles_loyalty_points_check CHECK ((loyalty_points >= 0));

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.promotions add constraint promotions_code_key UNIQUE (code);

alter table public.promotions add constraint promotions_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])));

alter table public.promotions add constraint promotions_discount_value_check CHECK ((discount_value >= (0)::numeric));

alter table public.promotions add constraint promotions_pkey PRIMARY KEY (id);

alter table public.stock_movements add constraint stock_movements_pkey PRIMARY KEY (id);

alter table public.wishlist_items add constraint wishlist_items_pkey PRIMARY KEY (wishlist_id, product_id);

alter table public.wishlists add constraint wishlists_pkey PRIMARY KEY (id);

alter table public.wishlists add constraint wishlists_user_id_key UNIQUE (user_id);

alter table public.categories add constraint categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL;

alter table public.customer_addresses add constraint customer_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.customer_notes add constraint customer_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.customer_notes add constraint customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.inventory_levels add constraint inventory_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE;

alter table public.inventory_levels add constraint inventory_levels_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

alter table public.loyalty_transactions add constraint loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.loyalty_transactions add constraint loyalty_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table public.order_items add constraint order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

alter table public.orders add constraint orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.orders add constraint orders_pricing_tier_id_fkey FOREIGN KEY (pricing_tier_id) REFERENCES pricing_tiers(id) ON DELETE SET NULL;

alter table public.payments add constraint payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table public.product_prices add constraint product_prices_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES pricing_tiers(id) ON DELETE CASCADE;

alter table public.product_prices add constraint product_prices_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

alter table public.product_variants add constraint product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

alter table public.products add constraint products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;

alter table public.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.stock_movements add constraint stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.stock_movements add constraint stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

alter table public.stock_movements add constraint stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

alter table public.wishlist_items add constraint wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

alter table public.wishlist_items add constraint wishlist_items_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE;

alter table public.wishlists add constraint wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_inventory_variant ON public.inventory_levels USING btree (variant_id);

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);

CREATE INDEX idx_products_brand ON public.products USING btree (brand_id);

CREATE INDEX idx_products_category ON public.products USING btree (category_id);

CREATE INDEX idx_stock_movements_variant ON public.stock_movements USING btree (variant_id, created_at DESC);

CREATE INDEX idx_variants_product ON public.product_variants USING btree (product_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone');
  return new;
  end;
  $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
  $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end
$$;

alter table public.brands enable row level security;

alter table public.categories enable row level security;

alter table public.customer_addresses enable row level security;

alter table public.customer_notes enable row level security;

alter table public.inventory_levels enable row level security;

alter table public.inventory_locations enable row level security;

alter table public.loyalty_transactions enable row level security;

alter table public.order_items enable row level security;

alter table public.orders enable row level security;

alter table public.payments enable row level security;

alter table public.pricing_tiers enable row level security;

alter table public.product_prices enable row level security;

alter table public.product_variants enable row level security;

alter table public.products enable row level security;

alter table public.profiles enable row level security;

alter table public.promotions enable row level security;

alter table public.stock_movements enable row level security;

alter table public.wishlist_items enable row level security;

alter table public.wishlists enable row level security;

create policy "public brands read" on public.brands as permissive for select to public
  using (is_active);

create policy "staff brands" on public.brands as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "public catalog read" on public.categories as permissive for select to public
  using (is_active);

create policy "staff categories" on public.categories as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer addresses own" on public.customer_addresses as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy "staff customers addresses" on public.customer_addresses as permissive for select to public
  using (is_admin());

create policy "staff customer notes" on public.customer_notes as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "staff inventory" on public.inventory_levels as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "staff locations" on public.inventory_locations as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer loyalty own" on public.loyalty_transactions as permissive for select to public
  using ((auth.uid() = customer_id));

create policy "staff loyalty" on public.loyalty_transactions as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer order items own" on public.order_items as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.customer_id = auth.uid())))));

create policy "staff order items" on public.order_items as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer orders own" on public.orders as permissive for select to public
  using ((auth.uid() = customer_id));

create policy "staff orders" on public.orders as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer payments own" on public.payments as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = payments.order_id) AND (o.customer_id = auth.uid())))));

create policy "staff payments" on public.payments as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "staff tiers" on public.pricing_tiers as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "public prices read" on public.product_prices as permissive for select to public
  using (true);

create policy "staff prices" on public.product_prices as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "public variants read" on public.product_variants as permissive for select to public
  using (is_active);

create policy "staff variants" on public.product_variants as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "public products read" on public.products as permissive for select to public
  using (is_active);

create policy "staff products" on public.products as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "admin full access profiles" on public.profiles as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer read own profile" on public.profiles as permissive for select to public
  using ((auth.uid() = id));

create policy "customer update own profile" on public.profiles as permissive for update to public
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

create policy "public promotion read" on public.promotions as permissive for select to public
  using ((is_active AND ((ends_at IS NULL) OR (ends_at > now()))));

create policy "staff promotions" on public.promotions as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "staff stock movements" on public.stock_movements as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy "customer wishlist items own" on public.wishlist_items as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM wishlists w
  WHERE ((w.id = wishlist_items.wishlist_id) AND (w.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM wishlists w
  WHERE ((w.id = wishlist_items.wishlist_id) AND (w.user_id = auth.uid())))));

create policy "customer wishlist own" on public.wishlists as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
