-- Product page details and customer reviews.
--  1. products.benefits / how_to_use / ingredients: shown on the product page (benefit cards and
--     the How to Use / Ingredients tabs) only when filled. Ingredients are "key ingredients" or
--     fragrance notes taken from the product description or the product's known formula; left
--     empty where not known, so the tab is hidden rather than guessed.
--  2. product_reviews: written reviews. Anyone can read them. Customers write them only through
--     submit_review(), which requires a delivered or completed order containing the product and
--     keeps products.rating / review_count up to date.
--  3. demo_product_details() fills the details for the demo catalogue; reset_demo() calls it.

alter table public.products
  add column benefits text[] not null default '{}',
  add column how_to_use text,
  add column ingredients text;

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 1000),
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index idx_product_reviews_product on public.product_reviews (product_id, created_at desc);
create index idx_product_reviews_customer on public.product_reviews (customer_id);

alter table public.product_reviews enable row level security;
create policy "Anyone can read reviews" on public.product_reviews
  for select to anon, authenticated using (true);
create policy "Staff can remove reviews" on public.product_reviews
  for delete to authenticated using ((select public.is_admin()));

create or replace function public.submit_review(p_product_id uuid, p_rating integer, p_body text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then
    raise exception 'Please sign in to write a review.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5 stars.' using errcode = '22023';
  end if;
  if char_length(v_body) < 3 or char_length(v_body) > 1000 then
    raise exception 'Write between 3 and 1000 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.orders o
    join public.order_items i on i.order_id = o.id
    join public.product_variants v on v.id = i.variant_id
    where o.customer_id = v_uid and v.product_id = p_product_id and o.status in ('delivered', 'completed')
  ) then
    raise exception 'You can review a product once an order with it has been delivered.' using errcode = '42501';
  end if;
  if exists (select 1 from public.product_reviews where product_id = p_product_id and customer_id = v_uid) then
    raise exception 'You have already reviewed this product.' using errcode = '23505';
  end if;

  -- Show "Grace A." rather than a full name.
  select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Customer')
         || coalesce(' ' || nullif(left(split_part(btrim(full_name), ' ', 2), 1), '') || '.', '')
    into v_name from public.profiles where id = v_uid;

  insert into public.product_reviews (product_id, customer_id, reviewer_name, rating, body)
  values (p_product_id, v_uid, coalesce(v_name, 'Customer'), p_rating, v_body);

  update public.products
  set rating = round((rating * review_count + p_rating) / (review_count + 1), 1),
      review_count = review_count + 1
  where id = p_product_id;
end;
$$;

revoke execute on function public.submit_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

create or replace function public.demo_product_details()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.products p
  set benefits = v.benefits, how_to_use = v.how_to_use, ingredients = v.ingredients
  from (values
    -- Wigs
    ('body-wave-lace-front-wig', array['Pre-plucked 13x4 HD lace', 'Glueless fit, adjustable straps', '100% human hair: curl or colour it'],
     'Put on a wig cap, adjust the straps for a snug fit and trim the lace along your hairline. Wash with sulphate-free shampoo and air dry on a wig stand.', null),
    ('straight-bone-lace-front-wig', array['Silky bone straight finish', 'HD lace for all skin tones', '100% human hair'],
     'Put on a wig cap, adjust the straps and trim the lace along your hairline. Use a heat protectant before flat ironing.', null),
    ('deep-wave-closure-wig', array['Defined deep wave curls', 'Beginner-friendly 5x5 closure', '100% human hair'],
     'Wear over a wig cap and adjust the straps. Refresh curls with water and a leave-in conditioner, and finger-detangle instead of brushing.', null),
    ('kinky-curly-afro-wig', array['Full, voluminous afro texture', 'Blends with natural hair', 'Glueless cap'],
     'Wear over a wig cap and fluff the curls with your fingers. Spritz with water and leave-in conditioner to refresh.', null),
    ('honey-blonde-body-wave-wig', array['Pre-coloured 27 honey blonde', 'Ready to wear', '100% human hair'],
     'Put on a wig cap, adjust the straps and trim the lace. Use colour-safe, sulphate-free shampoo to keep the shade bright.', null),
    ('water-wave-headband-wig', array['No glue, no lace', 'On in under a minute', 'Headband included'],
     'Slip the wig on, place the attached headband along your hairline and secure the combs. Detangle gently with a wide-tooth comb.', null),
    ('ombre-highlight-straight-wig', array['Natural roots, auburn highlights', 'T-part lace', '100% human hair'],
     'Wear over a wig cap and adjust the straps. Use colour-safe shampoo and a heat protectant before styling.', null),
    ('pixie-bob-lace-wig', array['Chic short bob, side part', 'Easy everyday style', '100% human hair'],
     'Wear over a wig cap and adjust for a snug fit. Wrap at night with a satin scarf to keep the shape.', null),
    -- Hair pieces
    ('afro-puff-drawstring-ponytail', array['Instant afro puff', 'Drawstring and two combs', 'Blends with natural texture'],
     'Gather your hair into a bun, slide in the combs and pull the drawstring tight. Tuck the string under the puff.', null),
    ('body-wave-clip-in-ponytail', array['Wrap-around clip-in', 'Sleek high pony in minutes', '20" body wave'],
     'Tie your hair into a ponytail, clip the piece over it and wrap the strip around the base to hide the clip.', null),
    ('curly-bang-fringe', array['Clip-in curly bangs', 'Switch up your look', 'No glue needed'],
     'Part your hair where the fringe should sit, clip it in and blend the curls with your fingers.', null),
    ('bun-chignon-piece', array['Elegant event-ready bun', 'Quick to put on', 'Smooth finish'],
     'Slick your hair into a low or high bun, place the chignon over it and secure it with the combs or pins.', null),
    ('straight-lace-closure-4x4', array['Free-part 4x4 HD lace', 'Finishes your install', '100% human hair'],
     'Place over braided hair, secure with adhesive or sew in, and trim the lace along your hairline.', null),
    -- Braids
    ('darling-super-star-braid', array['Soft and tangle-free', 'Easy to plait', 'Kenya''s favourite braid'],
     'Section your hair, divide the braid into pieces and feed them in as you plait. Dip the ends in hot water to seal.', null),
    ('xpression-ultra-braid', array['Pre-stretched feel', '82" long', 'Perfect for box braids'],
     'Stretch and divide the hair, then braid in from the root. Seal the ends with hot water.', null),
    ('pre-stretched-braiding-hair', array['Saves salon time', 'Feathered ends', 'Natural yaki texture'],
     'Use straight from the pack: no stretching needed. Braid in from the root and seal the ends with hot water.', null),
    ('passion-twist-crochet-hair', array['Bohemian passion twists', 'Pre-looped for crochet', 'Lightweight'],
     'Cornrow your hair, then hook each loop through the cornrows with a crochet needle and secure.', null),
    ('butterfly-locs-crochet', array['Distressed butterfly locs', 'Pre-looped', 'Lightweight'],
     'Cornrow your hair and crochet each loc in from the root. Trim any long fibres for a neat finish.', null),
    ('knotless-goddess-braid-hair', array['Curly ends for goddess styles', 'Knotless-friendly', 'Soft finish'],
     'Feed the hair in gradually for knotless braids and leave the curly ends out. Refresh curls with mousse.', null),
    ('magic-hair-afro-kinky-bulk', array['Afro kinky texture', 'For twists and locs', 'Blends with natural hair'],
     'Separate small pieces and twist or loc them into your hair. Palm-roll to set.', null),
    -- Extensions
    ('brazilian-body-wave-bundle', array['Double-wefted', 'Virgin human hair', 'Can be dyed and heat styled'],
     'Sew onto a braided base or onto a wig cap. Wash with sulphate-free shampoo and air dry.', null),
    ('peruvian-straight-bundle', array['Silky straight', 'Minimal shedding', 'Virgin human hair'],
     'Sew onto a braided base or wig cap. Use a heat protectant before straightening.', null),
    ('malaysian-deep-wave-bundle', array['Holds its curl', 'Lustrous finish', 'Virgin human hair'],
     'Sew onto a braided base or wig cap. Refresh curls with water and leave-in conditioner.', null),
    ('clip-in-straight-extensions', array['Seven-piece set', 'Instant length and volume', 'Human hair'],
     'Section your hair from the nape up and snap each clip in close to the root. Remove before sleeping.', null),
    ('tape-in-extensions', array['Flat and discreet', 'Lasts 6 to 8 weeks', 'Remy human hair'],
     'Best fitted by a stylist: tapes are sandwiched around thin sections of clean, dry hair. Avoid oils near the tapes.', null),
    -- Hair care
    ('hair-growth-oil', array['For edges and thinning areas', 'Lightweight oil blend', 'Use on hair and scalp'],
     'Apply a few drops to the scalp and edges and massage in for two minutes. Use 3 to 4 times a week.', 'Rosemary oil and castor oil.'),
    ('curl-enhancing-smoothie', array['Defines curls', 'Reduces frizz', 'Softens and moisturises'],
     'Apply to clean, damp hair in sections, comb through and style. Air dry or diffuse.', 'Shea butter, coconut oil and hibiscus.'),
    ('leave-in-conditioner', array['Daily moisture', 'Detangles', 'For natural hair'],
     'Spray or smooth onto clean, damp hair from mid-lengths to ends. Do not rinse.', null),
    ('edge-control-gel', array['Strong hold', 'No flakes', 'No white cast'],
     'Apply a small amount to your edges and lay them with an edge brush. Tie with a scarf for 5 minutes to set.', null),
    ('wig-bond-adhesive', array['Waterproof hold', 'Up to 2 weeks', 'For lace wigs'],
     'Apply thin layers along your hairline, letting each turn clear before the next. Press the lace on and hold.', null),
    ('heat-protectant-spray', array['Protects up to 230°C', 'For hair and wigs', 'Lightweight'],
     'Spray evenly on dry or damp hair before blow-drying, curling or straightening.', null),
    -- Cosmetics
    ('fenty-pro-filtr-foundation', array['Soft matte finish', 'Long-wear', 'Shades for deeper skin tones'],
     'Shake well. Apply a small amount from the centre of the face outwards with a brush or sponge, then build coverage.', null),
    ('fit-me-matte-foundation', array['Matte finish', 'Blurs pores', 'Great for oily skin'],
     'Apply with fingers, a brush or a sponge, blending outwards. Set with powder for extra shine control.', null),
    ('black-opal-true-color-foundation', array['Oil-free', 'Made for women of colour', 'Natural finish'],
     'Apply evenly with a sponge or brush and blend into the jawline.', null),
    ('nyx-matte-lipstick', array['Creamy matte colour', 'Lightweight feel', 'Comfortable wear'],
     'Apply from the centre of the lips outwards with the applicator. Let it set for a minute.', null),
    ('superstay-matte-ink', array['Up to 16-hour wear', 'Transfer-resistant', 'Matte finish'],
     'Apply to bare lips, starting at the Cupid''s bow, and let it dry. Remove with an oil-based remover.', null),
    ('fenty-gloss-bomb', array['Non-sticky shine', 'Universal shade', 'Smooth feel'],
     'Swipe on alone or over lipstick for extra shine.', null),
    ('loreal-lash-paradise-mascara', array['Volumising', 'Soft, full lashes', 'No clumps'],
     'Wiggle the brush from the root to the tip of the lashes. Build with a second coat.', null),
    ('nyx-epic-ink-liner', array['Waterproof', 'Felt-tip precision', 'Sharp wings'],
     'Draw along the upper lash line from the inner corner out, then flick the tip upwards for a wing.', null),
    ('velvet-setting-powder', array['Sets makeup', 'No flashback', 'Finely milled'],
     'Press lightly over foundation with a puff or fluffy brush, focusing on the T-zone.', null),
    ('flawless-concealer-pen', array['Brightening', 'Click-pen applicator', 'Covers dark circles'],
     'Click to release, dot under the eyes or on spots and blend with a fingertip or sponge.', null),
    ('nude-glam-eyeshadow-palette', array['Twelve warm nudes', 'Matte and shimmer', 'Day to night looks'],
     'Apply a matte shade all over the lid, deepen the crease with a darker one and add shimmer to the centre.', null),
    ('blush-duo', array['Buildable colour', 'Natural flush', 'Two shades'],
     'Smile and sweep onto the apples of the cheeks, blending up towards the temples.', null),
    -- Skincare
    ('bright-glow-serum', array['Evens skin tone', 'Boosts glow', 'Lightweight serum'],
     'Apply 3 to 4 drops to clean skin morning and evening, before moisturiser. Use sunscreen during the day.', 'Vitamin C and niacinamide.'),
    ('cerave-hydrating-cleanser', array['Gentle, non-foaming', 'Hydrates while cleansing', 'For normal to dry skin'],
     'Massage onto damp skin, then rinse with lukewarm water. Use morning and evening.', 'Ceramides and hyaluronic acid.'),
    ('cerave-moisturising-cream', array['Restores the skin barrier', 'Rich, non-greasy', 'Face and body'],
     'Apply liberally to face and body as often as needed, especially after bathing.', 'Ceramides and hyaluronic acid.'),
    ('ordinary-niacinamide-zinc', array['Reduces the look of blemishes', 'Balances oily skin', 'Water-based serum'],
     'Apply a few drops to the face morning and evening, before heavier creams.', 'Niacinamide 10% and zinc PCA 1%.'),
    ('nivea-soft-cream', array['Light all-over moisture', 'Face, body and hands', 'Fast absorbing'],
     'Apply to clean skin on the face, body and hands whenever it feels dry.', 'Jojoba oil and vitamin E.'),
    ('garnier-vitamin-c-serum', array['Targets dark spots', 'Brightens', 'Lightweight'],
     'Apply 3 to 4 drops to clean skin before moisturiser, morning and evening. Use sunscreen during the day.', 'Vitamin C.'),
    ('shea-butter-body-lotion', array['Deeply nourishing', 'Softens dry skin', 'Everyday body care'],
     'Massage into skin after bathing, focusing on dry areas like elbows and knees.', 'Raw shea butter.'),
    ('spf50-sunscreen-gel', array['SPF 50', 'No white cast', 'Invisible gel'],
     'Apply generously 15 minutes before sun exposure as the last step of your morning routine. Reapply every 2 hours outdoors.', null),
    ('rose-water-toner', array['Refreshing', 'Alcohol-free', 'Preps skin'],
     'After cleansing, sweep over the face with a cotton pad or mist directly. Follow with serum or moisturiser.', 'Rose water.'),
    ('african-black-soap-face-wash', array['Deep cleansing', 'For oily and blemish-prone skin', 'Gentle daily wash'],
     'Lather with water, massage onto the face for 30 seconds and rinse. Use morning and evening.', 'African black soap and tea tree.'),
    -- Perfumes
    ('lattafa-khamrah', array['Warm, sweet and spicy', 'Long-lasting', 'Evening favourite'],
     'Spray on pulse points (wrists, neck, behind the ears) from about 15cm away. Don''t rub it in.', 'Fragrance notes: cinnamon, dates and praline.'),
    ('vs-bombshell', array['Bright, flirty floral', 'Everyday wear', 'Iconic scent'],
     'Spray on pulse points from about 15cm away. Don''t rub it in.', 'Fragrance notes: passion fruit, peony and vanilla orchid.'),
    ('armaf-club-de-nuit-woman', array['Elegant floral chypre', 'Excellent projection', 'Long-lasting'],
     'Spray on pulse points from about 15cm away. Don''t rub it in.', 'Fragrance notes: rose, jasmine and patchouli.'),
    ('velvet-rose-body-mist', array['Light rose scent', 'Everyday freshness', 'All over the body'],
     'Mist over the body after bathing and reapply during the day.', null),
    ('lattafa-yara', array['Soft, creamy and powdery', 'Very popular', 'Long-lasting'],
     'Spray on pulse points from about 15cm away. Don''t rub it in.', 'Fragrance notes: orchid, heliotrope and vanilla.'),
    ('vanilla-musk-perfume-oil', array['Alcohol-free', 'Lasts all day', 'Roll-on'],
     'Roll onto wrists, neck and behind the ears.', null),
    -- Accessories
    ('satin-bonnet', array['Protects hair overnight', 'Reduces frizz', 'Fits wigs too'],
     'Put on at bedtime, covering all your hair or wig. Hand wash in cool water.', null),
    ('silk-pillowcase', array['Reduces breakage', 'Less frizz', 'Gentle on skin'],
     'Slip over a standard pillow. Hand wash or use a delicate cycle in cool water.', null),
    ('wig-stand-mannequin', array['For styling and storage', 'Canvas block head', 'Keeps wigs in shape'],
     'Pin the wig to the head with T-pins while styling. Store wigs on it between wears.', null),
    ('wide-tooth-detangling-comb', array['Gentle detangling', 'For curls and wigs', 'Less breakage'],
     'Detangle from the ends up to the roots, on damp or conditioned hair.', null),
    ('makeup-brush-set', array['12 soft synthetic brushes', 'Face and eyes', 'Pouch included'],
     'Use the large brushes for powder and foundation and the small ones for eyes. Wash weekly with mild soap.', null),
    ('beauty-blender-duo', array['Flawless base', 'Latex-free', 'Two sponges'],
     'Dampen and squeeze out the water, then bounce foundation or concealer onto the skin. Wash after use.', null),
    ('edge-brush-duo', array['Lays edges neatly', 'Dual-ended', 'Brush and comb'],
     'Apply edge control, then use the brush to sweep and swirl your edges into place.', null),
    -- Kids Collection
    ('kids-songa-braid', array['One pack for a full style', 'Bright kids colours', 'Pre-stretched'],
     'Section your child''s hair, divide the braid into pieces and plait in gently from the root. Seal the ends with warm water.', null),
    ('kids-ballerina', array['Ready-made crochet braids', 'Playful kids look', 'Lightweight'],
     'Cornrow the hair, then crochet each piece in with a crochet needle. Keep tension light on the edges.', null),
    ('kids-sasha', array['Soft, bouncy curls', 'Crochet install', 'Lightweight'],
     'Cornrow the hair and crochet the curls in from the root. Refresh with a light spritz of water.', null),
    ('kids-shanilia', array['Crochet curls', 'Ombré pink and auburn shades', 'Lightweight'],
     'Cornrow the hair and crochet the curls in. Separate them gently with your fingers for volume.', null),
    ('kids-temple-curl', array['Defined spiral curls', 'Crochet install', 'Lightweight'],
     'Cornrow the hair and crochet the curls in. Avoid brushing: separate with your fingers.', null),
    ('kids-barbie', array['Neat crochet twists', 'Easy kids style', 'Lightweight'],
     'Cornrow the hair and crochet the twists in from the root. Tie with a satin scarf at night.', null),
    ('kids-marvel-junior', array['Made for kids', 'Lightweight'], null, null),
    ('kids-tamasha', array['Soft crochet locs', 'Kids length', 'Lightweight'],
     'Cornrow the hair and crochet each loc in from the root.', null)
  ) as v(slug, benefits, how_to_use, ingredients)
  where p.slug = v.slug;
end;
$$;

revoke execute on function public.demo_product_details() from public, anon, authenticated;

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
  perform public.demo_product_details();
  insert into public.activity_log (actor_id, action, details) values (auth.uid(), 'demo.reset', '{}'::jsonb);
end;
$$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

select public.demo_product_details();
