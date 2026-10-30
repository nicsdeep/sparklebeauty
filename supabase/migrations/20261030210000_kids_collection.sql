-- Kids Collection: the Angels "Little Angels" kids braids Sparkle sells, under a new
-- Hair > Kids Braids category. Prices are Nicholas's wholesale list; retail is the same
-- amount, as he confirmed. Photos are from Sparkle's own Facebook posts, saved in
-- public/products/kids/ (Sasha and Barbie are cropped from the brand poster Sparkle posted;
-- Marvel Junior has no photo yet and falls back to the category image).
-- demo_kids_collection() is idempotent, runs once here, and reset_demo() now calls it after
-- demo_seed() and demo_images() so the collection survives a demo reset.

create or replace function public.demo_kids_collection()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_retail uuid;
  v_wholesale uuid;
  v_loc uuid;
  v_cat uuid;
  v_brand uuid;
  v_pid uuid;
  v_vid uuid;
  v_n integer := 0;
  v_prod record;
begin
  select id into v_retail from public.pricing_tiers where code = 'retail';
  select id into v_wholesale from public.pricing_tiers where code = 'wholesale';
  select public.main_location_id() into v_loc;

  insert into public.categories (name, slug, description, parent_id, sort_order)
  values ('Kids Braids', 'kids-braids', 'Little Angels crochet braids and curls for children',
          (select id from public.categories where slug = 'hair'), 6)
  on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug = 'kids-braids';

  insert into public.brands (name, slug) values ('Angels', 'angels') on conflict (slug) do nothing;
  select id into v_brand from public.brands where slug = 'angels';

  for v_prod in
    select * from (values
      -- slug, name, KES (retail = wholesale), SKU stem, style, featured, photos, description
      ('kids-songa-braid', 'Songa Braid (Kids)', 145, 'KIDSONGA', 'Pre-stretched', true,
       array['/products/kids/songa-1.jpg', '/products/kids/songa-2.jpg'],
       'Angels Songa 3x pre-stretched braid. One pack does a full kids style, in bright colours.'),
      ('kids-ballerina', 'Ballerina (Kids)', 150, 'KIDBALLER', 'Crochet', true,
       array['/products/kids/ballerina-1.jpg', '/products/kids/ballerina-2.jpg'],
       'Little Angels Ballerina crochet braids for a playful, ready-made look.'),
      ('kids-sasha', 'Sasha (Kids)', 185, 'KIDSASHA', 'Crochet', false,
       array['/products/kids/sasha-1.jpg'],
       'Little Angels Sasha crochet curls for soft, bouncy kids styles.'),
      ('kids-shanilia', 'Shanilia (Kids)', 170, 'KIDSHANIL', 'Crochet', false,
       array['/products/kids/shanilia-1.jpg', '/products/kids/shanilia-2.jpg'],
       'Little Angels Shanilia crochet curls, including ombré pink and auburn shades.'),
      ('kids-temple-curl', 'Temple Curl (Kids)', 195, 'KIDTEMPLE', 'Crochet', true,
       array['/products/kids/temple-1.jpg', '/products/kids/temple-2.jpg', '/products/kids/temple-3.jpg'],
       'Little Angels Temple Curls crochet hair with defined spiral curls.'),
      ('kids-barbie', 'Barbie (Kids)', 250, 'KIDBARBIE', 'Crochet', false,
       array['/products/kids/barbie-1.jpg'],
       'Little Angels Barbie crochet twists for neat, easy kids styles.'),
      ('kids-marvel-junior', 'Marvel Junior (Kids)', 235, 'KIDMARVEL', 'Crochet', false,
       array[]::text[],
       'Marvel Junior braid for kids.'),
      ('kids-tamasha', 'Tamasha (Kids)', 305, 'KIDTAMASH', 'Crochet', false,
       array['/products/kids/tamasha-1.jpg'],
       'Angels Tamasha kids crochet locs.')
    ) as t(slug, name, price, sku, style, featured, photos, description)
  loop
    v_n := v_n + 1;
    insert into public.products (category_id, brand_id, name, slug, description, is_featured, image_urls)
    values (v_cat, v_brand, v_prod.name, v_prod.slug, v_prod.description, v_prod.featured, v_prod.photos)
    on conflict (slug) do nothing
    returning id into v_pid;
    continue when v_pid is null;  -- already there

    insert into public.product_variants (product_id, sku, barcode, name, hair_type, hair_style)
    values (v_pid, v_prod.sku || '-1', '6169' || lpad(v_n::text, 9, '0'), null, 'Synthetic', v_prod.style)
    returning id into v_vid;
    insert into public.product_prices (variant_id, tier_id, amount, compare_at_amount)
    values (v_vid, v_retail, v_prod.price, null), (v_vid, v_wholesale, v_prod.price, null);
    insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level)
    values (v_vid, v_loc, 36, 12);
  end loop;
end;
$$;

revoke execute on function public.demo_kids_collection() from public, anon, authenticated;

create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_role_admin() then
    raise exception 'Only an admin can reset the demo.' using errcode = '42501';
  end if;
  perform public.demo_seed();
  perform public.demo_images();
  perform public.demo_kids_collection();
  insert into public.activity_log (actor_id, action, details) values (auth.uid(), 'demo.reset', '{}'::jsonb);
end;
$$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

select public.demo_kids_collection();
