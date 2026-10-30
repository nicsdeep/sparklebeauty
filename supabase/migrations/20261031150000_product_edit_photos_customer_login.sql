-- Closes the gaps left by the admin create forms:
--  1. Product photos: a public `product-images` storage bucket. Anyone can view the files (they are
--     shop photos); only staff can upload, replace or delete them.
--  2. admin_update_product(): edit a product's details, photos and options (prices, SKU, reorder
--     level, hide/show), and add new options with opening stock. Stock counts still change only
--     through adjust_stock() and sales, so every stock change stays in stock_movements.
--     admin_create_product() is redefined to take several photos too.
--  3. admin_set_customer_login(): staff give a customer online access (email + temporary password)
--     when the customer was added in store or forgot their password. There is no email-based reset
--     because the project has no email (SMTP) service configured.

-- 1. Photo storage -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "product images upload (staff)" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product images update (staff)" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product images delete (staff)" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
-- Staff need to read the object rows to replace or delete them; the public URL serves everyone else.
create policy "product images read (staff)" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- 2. Edit a product ----------------------------------------------------------------------------

-- p_product: {name, category_slug, brand, description, images: [text], is_featured, is_active,
--             benefits: [text], how_to_use, ingredients, option_type, hair_texture, hair_type}
-- p_variants: [{id (existing) | none (new), option, sku, retail, wholesale, reorder_level, active, stock (new only)}]
create or replace function public.admin_update_product(p_id uuid, p_product jsonb, p_variants jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
  v_name text := btrim(coalesce(p_product->>'name', ''));
  v_cat uuid;
  v_brand uuid;
  v_brand_name text := nullif(btrim(coalesce(p_product->>'brand', '')), '');
  v_kind text := coalesce(nullif(p_product->>'option_type', ''), 'none');
  v_images text[];
  v_loc uuid := public.main_location_id();
  v_retail_tier uuid := (select id from public.pricing_tiers where code = 'retail');
  v_wholesale_tier uuid := (select id from public.pricing_tiers where code = 'wholesale');
  v_row jsonb;
  v_n integer := 0;
  v_vid uuid;
  v_option text;
  v_sku text;
  v_retail numeric;
  v_wholesale numeric;
  v_stock integer;
  v_active boolean;
  v_active_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only staff can edit products.' using errcode = '42501';
  end if;
  select slug into v_slug from public.products where id = p_id;
  if v_slug is null then
    raise exception 'Product not found.';
  end if;
  if v_name = '' then
    raise exception 'Enter the product name.';
  end if;
  select id into v_cat from public.categories where slug = p_product->>'category_slug';
  if v_cat is null then
    raise exception 'Choose a category.';
  end if;
  if v_kind not in ('none', 'length', 'colour', 'shade', 'size') then
    raise exception 'Unknown option type.';
  end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 or jsonb_array_length(p_variants) > 20 then
    raise exception 'A product needs between 1 and 20 options.';
  end if;

  select coalesce(array_agg(btrim(i) order by ord), '{}'::text[]) into v_images
  from jsonb_array_elements_text(coalesce(p_product->'images', '[]'::jsonb)) with ordinality as t(i, ord)
  where btrim(i) <> '';
  if cardinality(v_images) > 10 then
    raise exception 'A product can have up to 10 photos.';
  end if;
  if exists (select 1 from unnest(v_images) i where i !~ '^(/|https://)') then
    raise exception 'Photos must be uploaded files, site paths (/products/...) or https:// links.';
  end if;

  -- Checked before any change: options added below have no id yet.
  if exists (select 1 from public.product_variants v where v.product_id = p_id
             and v.id::text not in (select x->>'id' from jsonb_array_elements(p_variants) x where x ? 'id')) then
    raise exception 'Every existing option must be included; hide an option instead of removing it.';
  end if;

  if v_brand_name is not null then
    select id into v_brand from public.brands where lower(name) = lower(v_brand_name);
    if v_brand is null then
      insert into public.brands (name, slug)
      values (v_brand_name, trim(both '-' from regexp_replace(lower(v_brand_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4))
      returning id into v_brand;
    end if;
  end if;

  -- The slug stays the same so existing links, carts and wishlists keep working.
  update public.products
  set name = v_name, category_id = v_cat, brand_id = v_brand,
      description = nullif(btrim(coalesce(p_product->>'description', '')), ''),
      image_urls = v_images,
      is_featured = coalesce((p_product->>'is_featured')::boolean, false),
      is_active = coalesce((p_product->>'is_active')::boolean, true),
      benefits = coalesce((select array_agg(btrim(b)) from jsonb_array_elements_text(coalesce(p_product->'benefits', '[]'::jsonb)) b
                           where btrim(b) <> ''), '{}'::text[]),
      how_to_use = nullif(btrim(coalesce(p_product->>'how_to_use', '')), ''),
      ingredients = nullif(btrim(coalesce(p_product->>'ingredients', '')), ''),
      updated_at = now()
  where id = p_id;

  for v_row in select * from jsonb_array_elements(p_variants) loop
    v_n := v_n + 1;
    v_vid := nullif(v_row->>'id', '')::uuid;
    v_option := nullif(btrim(coalesce(v_row->>'option', '')), '');
    v_retail := nullif(v_row->>'retail', '')::numeric;
    v_wholesale := nullif(v_row->>'wholesale', '')::numeric;
    v_active := coalesce((v_row->>'active')::boolean, true);
    v_sku := upper(nullif(btrim(coalesce(v_row->>'sku', '')), ''));
    if v_active then v_active_count := v_active_count + 1; end if;

    if v_kind <> 'none' and v_option is null then
      raise exception 'Option % needs a name (e.g. 18" or Natural Black).', v_n;
    end if;
    if v_retail is null or v_retail <= 0 or v_retail > 1000000 then
      raise exception 'Option %: enter a retail price in KES.', v_n;
    end if;
    if v_wholesale is null or v_wholesale <= 0 or v_wholesale > v_retail then
      raise exception 'Option %: the wholesale price must be more than 0 and no higher than retail.', v_n;
    end if;

    if v_vid is not null then
      if not exists (select 1 from public.product_variants where id = v_vid and product_id = p_id) then
        raise exception 'Option % doesn''t belong to this product.', v_n;
      end if;
      if v_sku is null then
        raise exception 'Option %: the SKU can''t be empty.', v_n;
      end if;
      if exists (select 1 from public.product_variants where sku = v_sku and id <> v_vid) then
        raise exception 'SKU % is already used by another product.', v_sku;
      end if;
      update public.product_variants
      -- With no options, keep the item's own details (e.g. size 120ml or colour Blush Pink).
      set sku = v_sku, name = v_option, is_active = v_active,
          color = case when v_kind = 'colour' then v_option when v_kind = 'none' then color end,
          shade = case when v_kind = 'shade' then v_option when v_kind = 'none' then shade end,
          size = case when v_kind = 'size' then v_option when v_kind = 'none' then size end,
          hair_length = case when v_kind = 'length' then v_option when v_kind = 'none' then hair_length end,
          hair_texture = nullif(btrim(coalesce(p_product->>'hair_texture', '')), ''),
          hair_type = nullif(btrim(coalesce(p_product->>'hair_type', '')), '')
      where id = v_vid;
    else
      v_stock := coalesce(nullif(v_row->>'stock', '')::integer, 0);
      if v_stock < 0 or v_stock > 10000 then
        raise exception 'Option %: opening stock must be between 0 and 10,000.', v_n;
      end if;
      if v_sku is null then
        v_sku := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 10)) || '-' || v_n;
        while exists (select 1 from public.product_variants where sku = v_sku) loop
          v_sku := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 10)) || '-' || v_n || '-' || upper(substr(md5(random()::text), 1, 3));
        end loop;
      elsif exists (select 1 from public.product_variants where sku = v_sku) then
        raise exception 'SKU % is already used by another product.', v_sku;
      end if;
      insert into public.product_variants (product_id, sku, name, color, shade, size, hair_length, hair_texture, hair_type, is_active)
      values (p_id, v_sku, v_option,
              case when v_kind = 'colour' then v_option end, case when v_kind = 'shade' then v_option end,
              case when v_kind = 'size' then v_option end, case when v_kind = 'length' then v_option end,
              nullif(btrim(coalesce(p_product->>'hair_texture', '')), ''), nullif(btrim(coalesce(p_product->>'hair_type', '')), ''), v_active)
      returning id into v_vid;
      insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level) values (v_vid, v_loc, v_stock, 5);
      if v_stock > 0 then
        insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, notes, created_by)
        values (v_vid, v_loc, 'purchase', v_stock, 'manual', 'Opening stock', v_uid);
      end if;
    end if;

    insert into public.product_prices (variant_id, tier_id, amount) values (v_vid, v_retail_tier, v_retail), (v_vid, v_wholesale_tier, v_wholesale)
    on conflict (variant_id, tier_id) do update set amount = excluded.amount;
    insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level)
    values (v_vid, v_loc, 0, greatest(0, coalesce(nullif(v_row->>'reorder_level', '')::integer, 5)))
    on conflict (variant_id, location_id) do update set reorder_level = excluded.reorder_level, updated_at = now();
  end loop;

  if v_active_count = 0 then
    raise exception 'Keep at least one option available, or hide the whole product instead.';
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'product.updated', 'product', p_id, jsonb_build_object('name', v_name, 'options', v_n));
  return v_slug;
end;
$$;

revoke execute on function public.admin_update_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_update_product(uuid, jsonb, jsonb) to authenticated;

-- admin_create_product() now takes several photos (p_product.images), like the edit function.
create or replace function public.admin_create_product(p_product jsonb, p_variants jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_product->>'name', ''));
  v_cat uuid;
  v_brand uuid;
  v_brand_name text := nullif(btrim(coalesce(p_product->>'brand', '')), '');
  v_base text;
  v_slug text;
  v_kind text := coalesce(nullif(p_product->>'option_type', ''), 'none');
  v_images text[];
  v_pid uuid;
  v_vid uuid;
  v_loc uuid := public.main_location_id();
  v_retail_tier uuid := (select id from public.pricing_tiers where code = 'retail');
  v_wholesale_tier uuid := (select id from public.pricing_tiers where code = 'wholesale');
  v_row jsonb;
  v_n integer := 0;
  v_option text;
  v_sku text;
  v_retail numeric;
  v_wholesale numeric;
  v_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Only staff can add products.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Enter the product name.';
  end if;
  select id into v_cat from public.categories where slug = p_product->>'category_slug';
  if v_cat is null then
    raise exception 'Choose a category.';
  end if;
  if v_kind not in ('none', 'length', 'colour', 'shade', 'size') then
    raise exception 'Unknown option type.';
  end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 or jsonb_array_length(p_variants) > 20 then
    raise exception 'Add between 1 and 20 options.';
  end if;
  if v_kind = 'none' and jsonb_array_length(p_variants) > 1 then
    raise exception 'Choose an option type (length, colour, shade or size) to add more than one option.';
  end if;
  -- Photos: an ordered list (first = main photo); a single image_url is still accepted.
  select coalesce(array_agg(btrim(i) order by ord), '{}'::text[]) into v_images
  from jsonb_array_elements_text(coalesce(p_product->'images', jsonb_build_array(coalesce(p_product->>'image_url', '')))) with ordinality as t(i, ord)
  where btrim(i) <> '';
  if cardinality(v_images) > 10 then
    raise exception 'A product can have up to 10 photos.';
  end if;
  if exists (select 1 from unnest(v_images) i where i !~ '^(/|https://)') then
    raise exception 'Photos must be uploaded files, site paths (/products/...) or https:// links.';
  end if;

  if v_brand_name is not null then
    select id into v_brand from public.brands where lower(name) = lower(v_brand_name);
    if v_brand is null then
      insert into public.brands (name, slug)
      values (v_brand_name, trim(both '-' from regexp_replace(lower(v_brand_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4))
      returning id into v_brand;
    end if;
  end if;

  v_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'product'; end if;
  v_slug := v_base;
  while exists (select 1 from public.products where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.products (category_id, brand_id, name, slug, description, image_urls, is_featured,
                               benefits, how_to_use, ingredients)
  values (v_cat, v_brand, v_name, v_slug, nullif(btrim(coalesce(p_product->>'description', '')), ''),
          v_images,
          coalesce((p_product->>'is_featured')::boolean, false),
          coalesce((select array_agg(btrim(b)) from jsonb_array_elements_text(coalesce(p_product->'benefits', '[]'::jsonb)) b
                    where btrim(b) <> ''), '{}'::text[]),
          nullif(btrim(coalesce(p_product->>'how_to_use', '')), ''),
          nullif(btrim(coalesce(p_product->>'ingredients', '')), ''))
  returning id into v_pid;

  for v_row in select * from jsonb_array_elements(p_variants) loop
    v_n := v_n + 1;
    v_option := nullif(btrim(coalesce(v_row->>'option', '')), '');
    v_retail := nullif(v_row->>'retail', '')::numeric;
    v_wholesale := nullif(v_row->>'wholesale', '')::numeric;
    v_stock := coalesce(nullif(v_row->>'stock', '')::integer, 0);
    if v_kind <> 'none' and v_option is null then
      raise exception 'Option % needs a name (e.g. 18" or Natural Black).', v_n;
    end if;
    if v_retail is null or v_retail <= 0 or v_retail > 1000000 then
      raise exception 'Option %: enter a retail price in KES.', v_n;
    end if;
    if v_wholesale is null or v_wholesale <= 0 or v_wholesale > v_retail then
      raise exception 'Option %: the wholesale price must be more than 0 and no higher than retail.', v_n;
    end if;
    if v_stock < 0 or v_stock > 10000 then
      raise exception 'Option %: opening stock must be between 0 and 10,000.', v_n;
    end if;
    v_sku := upper(nullif(btrim(coalesce(v_row->>'sku', '')), ''));
    if v_sku is null then
      -- Automatic SKU, as in the demo seed; add a suffix if another product's name starts the same way.
      v_sku := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 10)) || '-' || v_n;
      while exists (select 1 from public.product_variants where sku = v_sku) loop
        v_sku := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 10)) || '-' || v_n || '-' || upper(substr(md5(random()::text), 1, 3));
      end loop;
    elsif exists (select 1 from public.product_variants where sku = v_sku) then
      raise exception 'SKU % is already used by another product.', v_sku;
    end if;

    insert into public.product_variants (product_id, sku, name, color, shade, size, hair_length, hair_texture, hair_type)
    values (v_pid, v_sku, v_option,
            case when v_kind = 'colour' then v_option end,
            case when v_kind = 'shade' then v_option end,
            case when v_kind = 'size' then v_option end,
            case when v_kind = 'length' then v_option end,
            nullif(btrim(coalesce(p_product->>'hair_texture', '')), ''),
            nullif(btrim(coalesce(p_product->>'hair_type', '')), ''))
    returning id into v_vid;
    insert into public.product_prices (variant_id, tier_id, amount) values (v_vid, v_retail_tier, v_retail), (v_vid, v_wholesale_tier, v_wholesale);
    insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level)
    values (v_vid, v_loc, v_stock, greatest(0, coalesce(nullif(v_row->>'reorder_level', '')::integer, 5)));
    if v_stock > 0 then
      insert into public.stock_movements (variant_id, location_id, movement_type, quantity_change, reference_type, notes, created_by)
      values (v_vid, v_loc, 'purchase', v_stock, 'manual', 'Opening stock', v_uid);
    end if;
  end loop;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'product.created', 'product', v_pid, jsonb_build_object('name', v_name, 'options', v_n));
  return v_slug;
end;
$$;

revoke execute on function public.admin_create_product(jsonb, jsonb) from public, anon;
grant execute on function public.admin_create_product(jsonb, jsonb) to authenticated;

-- 3. Customer online access -----------------------------------------------------------------------

create or replace function public.admin_set_customer_login(p_customer_id uuid, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'Only staff can set up customer sign-in.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and role = 'customer') then
    raise exception 'This is not a customer account. Manage work users in Settings.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter the customer''s email address; they sign in with it.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_customer_id) then
    raise exception 'Another account already uses this email.';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Set a temporary password of at least 8 characters.';
  end if;

  update auth.users
  set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()),
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      banned_until = null, updated_at = now()
  where id = p_customer_id;
  -- Email sign-in needs an email identity; customers added in store don't have one yet.
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (p_customer_id::text, p_customer_id,
          jsonb_build_object('sub', p_customer_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now())
  on conflict (provider_id, provider) do update
  set identity_data = excluded.identity_data, updated_at = now();
  update public.profiles set email = v_email, updated_at = now() where id = p_customer_id;

  -- The password itself is never logged.
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'customer.login_set', 'profile', p_customer_id, jsonb_build_object('email', v_email));
end;
$$;

revoke execute on function public.admin_set_customer_login(uuid, text, text) from public, anon;
grant execute on function public.admin_set_customer_login(uuid, text, text) to authenticated;
