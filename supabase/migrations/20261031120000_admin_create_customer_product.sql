-- Admin "create" flows behind the dashboard's quick actions.
--  admin_create_customer(): staff add a customer (walk-in, phone or salon) without them signing up.
--    Creates the auth user with no password (like the demo seed); they can't sign in until
--    self-service password reset exists. Optional wholesale account.
--  admin_create_product(): staff add a product with its options, retail and wholesale prices
--    and opening stock in one transaction. Opening stock is recorded as a 'purchase' movement.
-- Promotions need no function: RLS already lets staff insert them, and the server action validates.

create or replace function public.admin_create_customer(
  p_full_name text, p_phone text, p_email text default null,
  p_business_name text default null, p_business_location text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_business text := nullif(btrim(coalesce(p_business_name, '')), '');
  v_id uuid := gen_random_uuid();
begin
  if not public.is_admin() then
    raise exception 'Only staff can add customers.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Enter the customer''s name.';
  end if;
  if v_phone is null or length(v_digits) not between 9 and 13 then
    raise exception 'Enter a valid phone number, e.g. 0712 345 678.';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address, or leave it empty.';
  end if;
  -- Same number written differently (0712..., +254712...) counts as a duplicate.
  if exists (select 1 from public.profiles
             where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)) then
    raise exception 'A customer with this phone number already exists.';
  end if;
  if v_email is not null and exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An account with this email already exists.';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, '',
          case when v_email is not null then now() end,
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_name, 'phone', v_phone), now(), now(), '', '', '', '');
  -- handle_new_user() has created the profile (role customer).

  if v_business is not null then
    insert into public.wholesale_accounts (profile_id, business_name, business_location, pricing_tier_id)
    values (v_id, v_business, nullif(btrim(coalesce(p_business_location, '')), ''),
            (select id from public.pricing_tiers where code = 'wholesale'));
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'customer.created', 'profile', v_id,
          jsonb_build_object('name', v_name, 'wholesale', v_business is not null));
  return v_id;
end;
$$;

revoke execute on function public.admin_create_customer(text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_customer(text, text, text, text, text) to authenticated;

-- p_product: {name, category_slug, brand (name, optional), description, image_url, is_featured,
--             benefits: [text], how_to_use, ingredients, option_type: length|colour|shade|size|none,
--             hair_texture, hair_type}
-- p_variants: [{option, sku, retail, wholesale, stock, reorder_level}] (one row when option_type is none)
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
  v_image text := nullif(btrim(coalesce(p_product->>'image_url', '')), '');
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
  if v_image is not null and v_image !~ '^(/|https://)' then
    raise exception 'The photo must be a site path (e.g. /products/photo.jpg) or an https:// link.';
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
          case when v_image is null then '{}'::text[] else array[v_image] end,
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
