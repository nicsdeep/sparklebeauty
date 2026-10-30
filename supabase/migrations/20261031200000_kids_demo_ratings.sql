-- Demo ratings for the Kids Collection. The rest of the demo catalogue got demo ratings from
-- demo_seed(); the kids products were added later with none, so they showed empty stars and
-- "(0)". These are demo figures like the others (see PROJECT_STATE "Seeded ratings"), applied
-- by demo_ratings(), which reset_demo() now calls after demo_kids_collection().
-- Real reviews (submit_review) still adjust the rating on top of these.

create or replace function public.demo_ratings()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.products p
  set rating = v.rating, review_count = v.reviews
  from (values
    ('kids-songa-braid', 4.8, 64),
    ('kids-ballerina', 4.7, 41),
    ('kids-shanilia', 4.6, 33),
    ('kids-sasha', 4.7, 27),
    ('kids-temple-curl', 4.9, 52),
    ('kids-barbie', 4.6, 22),
    ('kids-marvel-junior', 4.5, 18),
    ('kids-tamasha', 4.8, 29)
  ) as v(slug, rating, reviews)
  where p.slug = v.slug and p.review_count = 0;  -- never overwrite real reviews
end;
$$;
revoke execute on function public.demo_ratings() from public, anon, authenticated;

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
  perform public.demo_ratings();
  perform public.demo_product_details();
  update public.pricing_tiers set min_order_quantity = 10 where code = 'wholesale';
  insert into public.activity_log (actor_id, action, entity_type, entity_id, details) values (auth.uid(), 'demo.reset', null, null, '{}'::jsonb);
end;
$$;
revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

select public.demo_ratings();
