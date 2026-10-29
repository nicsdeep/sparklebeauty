-- Demo data for the CEO demo, and a protected reset that restores it.
-- demo_seed() wipes catalogue and transactional data and rebuilds the same starting
-- state every time (fixed IDs and a fixed random seed). Demo login passwords are NOT
-- set here; they are configured once outside the repo.

create or replace function public.demo_seed()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_retail uuid;
  v_wholesale uuid;
  v_loc uuid;
  v_admin uuid := 'a0000000-0000-4000-8000-000000000001';
  v_staff uuid := 'a0000000-0000-4000-8000-000000000002';
  v_grace uuid := 'c0000000-0000-4000-8000-000000000001';
  v_people jsonb;
  v_person jsonb;
  v_retail_ids uuid[];
  v_wholesale_ids uuid[];
  v_prod record;
  v_pid uuid;
  v_vid uuid;
  v_opts jsonb;
  v_opt jsonb;
  v_n integer;
  v_barcode integer := 0;
  v_price numeric;
  v_days integer[] := array[0,0,0,1,1,2,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,24,25,27,29];
  v_flow public.order_status[] := array['pending','confirmed','paid','processing','packed','dispatched','delivered','completed']::public.order_status[];
  i integer;
  v_at timestamptz;
  v_channel public.sales_channel;
  v_status public.order_status;
  v_customer uuid;
  v_is_wholesale boolean;
  v_method public.payment_method;
  v_order uuid;
  v_number text;
  v_sub numeric;
  v_fee numeric;
  v_total numeric;
  v_items integer;
  v_line record;
  v_qty integer;
  v_cats text[];
  v_profile record;
  v_s integer;
begin
  perform setseed(0.4242);

  -- Wipe ---------------------------------------------------------------------------
  delete from public.notifications where true;
  delete from public.order_events where true;
  delete from public.loyalty_transactions where true;
  delete from public.payments where true;
  delete from public.order_items where true;
  delete from public.stock_movements where true;
  delete from public.orders where true;
  delete from public.wishlist_items where true;
  delete from public.wishlists where true;
  delete from public.customer_addresses where true;
  delete from public.customer_notes where true;
  delete from public.activity_log where true;
  delete from public.wholesale_accounts where true;
  delete from public.inventory_levels where true;
  delete from public.product_prices where true;
  delete from public.product_variants where true;
  delete from public.products where true;
  delete from public.brands where true;
  delete from public.categories where true;
  delete from public.promotions where true;
  alter sequence public.order_number_seq restart with 1001;

  select id into v_retail from public.pricing_tiers where code = 'retail';
  select id into v_wholesale from public.pricing_tiers where code = 'wholesale';
  update public.pricing_tiers set min_order_quantity = 6 where id = v_wholesale;
  select public.main_location_id() into v_loc;
  if v_loc is null then
    insert into public.inventory_locations (name, location_type, address) values ('Main Store', 'store', 'Moi Avenue, Nairobi CBD')
    returning id into v_loc;
  end if;
  update public.inventory_locations set address = 'Moi Avenue, Nairobi CBD' where id = v_loc;

  -- People ------------------------------------------------------------------------
  -- [id suffix, full name, email, phone, city, area, months since joining, birthday month-day]
  v_people := '[
    ["001","Grace Achieng","grace.achieng@example.com","0712 345 678","Nairobi","Kilimani, Argwings Kodhek Rd",14,"11-08"],
    ["002","Wanjiru Kamau","wanjiru.kamau@example.com","0722 418 903","Nairobi","Westlands, Woodvale Grove",11,"03-14"],
    ["003","Faith Wambui","faith.wambui@example.com","0733 562 114","Thika","Section 9, Kenyatta Hwy",9,"07-22"],
    ["004","Mercy Chebet","mercy.chebet@example.com","0745 210 776","Eldoret","Elgon View, Uganda Rd",8,"01-30"],
    ["005","Lilian Muthoni","lilian.muthoni@example.com","0710 887 452","Nairobi","South B, Mchumbi Rd",13,"05-09"],
    ["006","Janet Njeri","janet.njeri@example.com","0798 334 120","Nairobi","Kileleshwa, Othaya Rd",6,"12-02"],
    ["007","Aisha Hassan","aisha.hassan@example.com","0701 456 893","Mombasa","Nyali, Links Rd",10,"09-17"],
    ["008","Brenda Atieno","brenda.atieno@example.com","0757 902 331","Kisumu","Milimani, Aga Khan Rd",7,"04-25"],
    ["009","Esther Nyambura","esther.nyambura@example.com","0728 671 205","Nakuru","Milimani, Kenyatta Ave",5,"10-11"],
    ["010","Purity Kerubo","purity.kerubo@example.com","0714 239 870","Nairobi","Kasarani, Mwiki Rd",4,"06-03"],
    ["011","Mary Wanjiku","mary.wanjiku@example.com","0726 105 448","Nairobi","Lavington, James Gichuru Rd",12,"02-19"],
    ["012","Diana Moraa","diana.moraa@example.com","0790 552 316","Nairobi","Ngong Rd, Adams Arcade",3,"08-27"],
    ["013","Sharon Jepkoech","sharon.jepkoech@example.com","0741 678 902","Eldoret","Kapsoya Estate",9,"11-21"],
    ["014","Caroline Akinyi","caroline.akinyi@example.com","0718 443 097","Kisumu","Tom Mboya Estate",6,"03-06"],
    ["015","Joy Mwende","joy.mwende@example.com","0702 917 664","Machakos","Machakos Town, Mwatu wa Ngoma Rd",2,"07-14"],
    ["016","Ann Wairimu","ann.wairimu@example.com","0729 380 215","Nairobi","Runda, Ruaka Rd",8,"09-30"],
    ["017","Naomi Chepkemoi","naomi.chepkemoi@example.com","0746 115 829","Nakuru","Section 58",5,"05-26"],
    ["018","Lucy Nduta","lucy.nduta@example.com","0711 664 309","Nairobi","Embakasi, Pipeline",1,"12-18"],
    ["019","Winnie Adhiambo","winnie.adhiambo@example.com","0795 228 471","Mombasa","Bamburi, Mtambo Rd",7,"01-12"],
    ["020","Rose Kemunto","rose.kemunto@example.com","0723 590 144","Kisii","Jogoo Rd, Kisii Town",4,"04-08"]
  ]'::jsonb;

  -- Fixed demo users (customers, wholesale buyers, admin, staff). Only created if missing,
  -- so reset never logs anyone out.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', u.full_name, 'phone', u.phone), now(), now(), '', '', '', ''
  from (
    select ('c0000000-0000-4000-8000-000000000' || (p->>0))::uuid as id, p->>2 as email, p->>1 as full_name, p->>3 as phone
    from jsonb_array_elements(v_people) p
    union all select 'c0000000-0000-4000-8000-000000000101', 'orders@mamapendosalon.example', 'Pendo Wekesa', '0720 118 552'
    union all select 'c0000000-0000-4000-8000-000000000102', 'buy@glamourbeautykisumu.example', 'Akinyi Otieno', '0738 407 219'
    union all select 'c0000000-0000-4000-8000-000000000103', 'neema@neemahairstudio.example', 'Neema Salim', '0704 663 981'
    union all select v_admin, 'admin@sparkle.example', 'Sparkle Admin', '0700 100 200'
    union all select v_staff, 'staff@sparkle.example', 'Esther Wanjiku (Cashier)', '0700 100 201'
  ) u
  where not exists (select 1 from auth.users au where au.id = u.id);

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select au.id::text, au.id, jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users au
  where (au.id in (v_admin, v_staff) or au.id::text like 'c0000000-0000-4000-8000-%')
    and not exists (select 1 from auth.identities ai where ai.user_id = au.id and ai.provider = 'email');

  -- Reset profiles to their seeded state.
  for v_person in select * from jsonb_array_elements(v_people) loop
    update public.profiles
    set role = 'customer', full_name = v_person->>1, email = v_person->>2, phone = v_person->>3,
        loyalty_points = 0, marketing_consent = (v_person->>0)::int % 4 <> 0,
        notify_email = true, notify_sms = true, notify_whatsapp = (v_person->>0)::int % 3 = 0,
        date_of_birth = to_date('1990-' || (v_person->>7), 'YYYY-MM-DD') + (((v_person->>0)::int % 9) * interval '1 year')::interval,
        created_at = now() - ((v_person->>6)::int * interval '1 month'), updated_at = now()
    where id = ('c0000000-0000-4000-8000-000000000' || (v_person->>0))::uuid;
    insert into public.customer_addresses (user_id, label, recipient_name, phone, address_line1, city, county, is_default)
    values (('c0000000-0000-4000-8000-000000000' || (v_person->>0))::uuid, 'Home', v_person->>1, v_person->>3,
            v_person->>5, v_person->>4, v_person->>4, true);
  end loop;
  update public.profiles set notify_whatsapp = true, marketing_consent = true where id = v_grace;

  update public.profiles p set role = 'customer', full_name = x.full_name, email = x.email, phone = x.phone,
         loyalty_points = 0, marketing_consent = true, created_at = now() - (x.months * interval '1 month')
  from (values ('c0000000-0000-4000-8000-000000000101'::uuid, 'Pendo Wekesa', 'orders@mamapendosalon.example', '0720 118 552', 16),
               ('c0000000-0000-4000-8000-000000000102'::uuid, 'Akinyi Otieno', 'buy@glamourbeautykisumu.example', '0738 407 219', 10),
               ('c0000000-0000-4000-8000-000000000103'::uuid, 'Neema Salim', 'neema@neemahairstudio.example', '0704 663 981', 7)) x(id, full_name, email, phone, months)
  where p.id = x.id;
  insert into public.wholesale_accounts (profile_id, business_name, business_location, pricing_tier_id) values
    ('c0000000-0000-4000-8000-000000000101', 'Mama Pendo Salon', 'Githurai 45, Nairobi', v_wholesale),
    ('c0000000-0000-4000-8000-000000000102', 'Glamour Beauty Shop', 'Kisumu CBD, Oginga Odinga St', v_wholesale),
    ('c0000000-0000-4000-8000-000000000103', 'Neema Hair Studio', 'Mombasa, Moi Avenue', v_wholesale);

  update public.profiles set role = 'admin', full_name = 'Sparkle Admin', email = 'admin@sparkle.example', phone = '0700 100 200' where id = v_admin;
  update public.profiles set role = 'staff', full_name = 'Esther Wanjiku', email = 'staff@sparkle.example', phone = '0700 100 201' where id = v_staff;

  v_retail_ids := array(select ('c0000000-0000-4000-8000-000000000' || lpad(g::text, 3, '0'))::uuid from generate_series(1, 20) g);
  v_wholesale_ids := array['c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000102', 'c0000000-0000-4000-8000-000000000103']::uuid[];

  -- Catalogue ---------------------------------------------------------------------
  insert into public.categories (name, slug, description, sort_order) values
    ('Hair', 'hair', 'Wigs, braids, extensions, hair pieces and hair care', 1),
    ('Cosmetics', 'cosmetics', 'Foundation, lips, eyes and face', 2),
    ('Skincare', 'skincare', 'Cleansers, serums, moisturisers and sun care', 3),
    ('Perfumes', 'perfumes', 'Perfumes, body mists and fragrance oils', 4),
    ('Accessories', 'accessories', 'Bonnets, brushes, tools and wig care', 5);
  insert into public.categories (name, slug, description, parent_id, sort_order)
  select x.name, x.slug, x.description, (select id from public.categories where slug = 'hair'), x.sort_order
  from (values ('Wigs', 'wigs', 'Lace front, closure and headband wigs', 1),
               ('Hair Pieces', 'hair-pieces', 'Ponytails, buns, fringes and closures', 2),
               ('Braids', 'braids', 'Braiding hair, crochet and locs', 3),
               ('Extensions', 'extensions', 'Bundles, clip-ins and tape-ins', 4),
               ('Hair Care', 'hair-care', 'Oils, conditioners, edge control and styling', 5)) x(name, slug, description, sort_order);

  insert into public.brands (name, slug) values
    ('Sparkle Signature', 'sparkle-signature'), ('Darling', 'darling'), ('Magic Hair', 'magic-hair'),
    ('X-pression', 'x-pression'), ('Cherish', 'cherish'), ('Fenty Beauty', 'fenty-beauty'), ('Maybelline', 'maybelline'),
    ('L''Oréal Paris', 'loreal-paris'), ('NYX Professional Makeup', 'nyx'), ('Black Opal', 'black-opal'),
    ('CeraVe', 'cerave'), ('The Ordinary', 'the-ordinary'), ('Nivea', 'nivea'), ('Garnier', 'garnier'),
    ('SheaMoisture', 'sheamoisture'), ('Lattafa', 'lattafa'), ('Victoria''s Secret', 'victorias-secret'), ('Armaf', 'armaf');

  for v_prod in
    select * from (values
      -- slug, category, brand, name, retail KES, kind, attributes, featured, on offer, description
      ('body-wave-lace-front-wig','wigs','sparkle-signature','Body Wave Lace Front Wig',18500,'wig','{"texture":"Body Wave","color":"Natural Black","type":"100% Human Hair","style":"13x4 Lace Front"}',true,false,'Soft, bouncy body wave with a natural hairline. Pre-plucked 13x4 HD lace, glueless fit with adjustable straps.'),
      ('straight-bone-lace-front-wig','wigs','sparkle-signature','Bone Straight Lace Front Wig',21000,'wig','{"texture":"Bone Straight","color":"Natural Black","type":"100% Human Hair","style":"13x4 Lace Front"}',true,false,'Silky bone straight hair with a sleek finish. HD lace melts into all skin tones.'),
      ('deep-wave-closure-wig','wigs','sparkle-signature','Deep Wave Closure Wig',15500,'wig','{"texture":"Deep Wave","color":"1B Natural Black","type":"100% Human Hair","style":"5x5 Closure"}',false,true,'Defined deep wave curls on a beginner-friendly 5x5 closure.'),
      ('kinky-curly-afro-wig','wigs','cherish','Kinky Curly Afro Wig',9800,'wig','{"texture":"Kinky Curly","color":"1B Natural Black","type":"Human Hair Blend","style":"Glueless Cap"}',false,false,'Full, voluminous afro texture that blends with natural hair.'),
      ('honey-blonde-body-wave-wig','wigs','sparkle-signature','Honey Blonde Body Wave Wig',19500,'wig','{"texture":"Body Wave","color":"27 Honey Blonde","type":"100% Human Hair","style":"13x4 Lace Front"}',true,false,'Warm honey blonde body wave, pre-coloured and ready to wear.'),
      ('water-wave-headband-wig','wigs','cherish','Water Wave Headband Wig',7900,'wig','{"texture":"Water Wave","color":"1B Natural Black","type":"Synthetic Blend","style":"Headband"}',false,true,'No glue, no lace. Slip on with the attached headband in under a minute.'),
      ('ombre-highlight-straight-wig','wigs','sparkle-signature','Ombre Highlight Straight Wig',16800,'wig','{"texture":"Straight","color":"1B/30 Ombre","type":"100% Human Hair","style":"T-Part Lace"}',false,false,'Natural black roots melting into auburn highlights.'),
      ('pixie-bob-lace-wig','wigs','sparkle-signature','Pixie Bob Lace Wig',8500,'single','{"texture":"Straight","color":"Natural Black","type":"100% Human Hair","style":"Short Bob","length":"10\""}',false,false,'A chic short bob with a side part. Easy everyday style.'),
      ('afro-puff-drawstring-ponytail','hair-pieces','magic-hair','Afro Puff Drawstring Ponytail',1800,'single','{"texture":"Kinky Curly","color":"1B Natural Black"}',false,false,'Instant afro puff with drawstring and two combs.'),
      ('body-wave-clip-in-ponytail','hair-pieces','sparkle-signature','Body Wave Clip-in Ponytail',2900,'single','{"texture":"Body Wave","color":"1B Natural Black","length":"20\""}',false,false,'Wrap-around clip-in ponytail for a sleek high pony.'),
      ('curly-bang-fringe','hair-pieces','cherish','Curly Bang Fringe',1500,'single','{"texture":"Curly","color":"1B Natural Black"}',false,false,'Clip-in curly bangs to switch up your look.'),
      ('bun-chignon-piece','hair-pieces','magic-hair','Bun Chignon Piece',1200,'single','{"texture":"Smooth","color":"1B Natural Black"}',false,false,'Elegant bun for weddings and events.'),
      ('straight-lace-closure-4x4','hair-pieces','sparkle-signature','Straight Lace Closure 4x4',5500,'length','{"texture":"Straight","color":"Natural Black","type":"100% Human Hair"}',false,false,'Free-part 4x4 HD lace closure to finish your install.'),
      ('darling-super-star-braid','braids','darling','Darling Super Star Braid',450,'braid','{"texture":"Smooth","type":"Synthetic"}',true,false,'Kenya''s favourite braid: soft, tangle-free and easy to plait.'),
      ('xpression-ultra-braid','braids','x-pression','X-pression Ultra Braid',650,'braid','{"texture":"Smooth","type":"Kanekalon"}',false,false,'Pre-stretched feel, 82" long, perfect for box braids.'),
      ('pre-stretched-braiding-hair','braids','darling','Pre-stretched Braiding Hair',750,'braid','{"texture":"Yaki","type":"Synthetic"}',false,true,'Saves time at the salon. Feathered ends for a natural finish.'),
      ('passion-twist-crochet-hair','braids','magic-hair','Passion Twist Crochet Hair',1100,'braid','{"texture":"Water Wave Twist","type":"Synthetic"}',false,false,'Bohemian passion twists, pre-looped for crochet.'),
      ('butterfly-locs-crochet','braids','darling','Butterfly Locs Crochet',1400,'braid','{"texture":"Distressed Locs","type":"Synthetic"}',false,false,'Distressed butterfly locs, lightweight and pre-looped.'),
      ('knotless-goddess-braid-hair','braids','x-pression','Knotless Goddess Braid Hair',950,'braid','{"texture":"Curly Ends","type":"Synthetic"}',false,false,'Braid hair with curly ends for goddess knotless styles.'),
      ('magic-hair-afro-kinky-bulk','braids','magic-hair','Afro Kinky Bulk Hair',550,'braid','{"texture":"Afro Kinky","type":"Synthetic"}',false,false,'Afro kinky bulk for twists and locs.'),
      ('brazilian-body-wave-bundle','extensions','sparkle-signature','Brazilian Body Wave Bundle',6500,'length','{"texture":"Body Wave","color":"Natural Black","type":"100% Virgin Human Hair"}',true,false,'Double-wefted virgin hair. Can be dyed and heat styled.'),
      ('peruvian-straight-bundle','extensions','sparkle-signature','Peruvian Straight Bundle',6200,'length','{"texture":"Straight","color":"Natural Black","type":"100% Virgin Human Hair"}',false,false,'Silky straight Peruvian hair with minimal shedding.'),
      ('malaysian-deep-wave-bundle','extensions','sparkle-signature','Malaysian Deep Wave Bundle',7200,'length','{"texture":"Deep Wave","color":"Natural Black","type":"100% Virgin Human Hair"}',false,true,'Lustrous deep wave bundles that hold their curl.'),
      ('clip-in-straight-extensions','extensions','cherish','Clip-in Straight Extensions Set',8900,'length','{"texture":"Straight","color":"1B Natural Black","type":"Human Hair"}',false,false,'Seven-piece clip-in set for instant length and volume.'),
      ('tape-in-extensions','extensions','sparkle-signature','Tape-in Extensions',9500,'length','{"texture":"Straight","color":"Natural Black","type":"Remy Human Hair"}',false,false,'Flat, discreet tape-ins that last 6 to 8 weeks.'),
      ('hair-growth-oil','hair-care','sparkle-signature','Hair Growth Oil',1000,'single','{"size":"120ml"}',false,false,'Rosemary and castor oil blend for edges and thinning areas.'),
      ('curl-enhancing-smoothie','hair-care','sheamoisture','Coconut & Hibiscus Curl Smoothie',2400,'single','{"size":"340g"}',false,false,'Defines curls and reduces frizz with shea butter and coconut oil.'),
      ('leave-in-conditioner','hair-care','sparkle-signature','Moisture Leave-in Conditioner',1100,'single','{"size":"250ml"}',false,false,'Daily leave-in for soft, detangled natural hair.'),
      ('edge-control-gel','hair-care','sparkle-signature','Edge Control Gel',650,'single','{"size":"100g"}',false,false,'Strong hold, no flakes, no white cast.'),
      ('wig-bond-adhesive','hair-care','sparkle-signature','Wig Bond Adhesive',1300,'single','{"size":"38ml"}',false,false,'Waterproof lace glue that holds up to 2 weeks.'),
      ('heat-protectant-spray','hair-care','sparkle-signature','Heat Protectant Spray',1250,'single','{"size":"200ml"}',false,true,'Protects hair and wigs up to 230°C.'),
      ('fenty-pro-filtr-foundation','cosmetics','fenty-beauty','Pro Filt''r Soft Matte Foundation',5200,'shade','{"shades":["330","420","445"],"size":"32ml"}',true,false,'Long-wear soft matte foundation in shades made for deeper skin tones.'),
      ('fit-me-matte-foundation','cosmetics','maybelline','Fit Me Matte + Poreless Foundation',1450,'shade','{"shades":["230 Natural Buff","310 Sun Beige","355 Coconut"],"size":"30ml"}',false,false,'Matte finish that blurs pores. Great for oily skin.'),
      ('black-opal-true-color-foundation','cosmetics','black-opal','True Color Liquid Foundation',2200,'shade','{"shades":["Hazelnut","Truly Topaz","Carob"],"size":"30ml"}',false,false,'Oil-free foundation designed for women of colour.'),
      ('nyx-matte-lipstick','cosmetics','nyx','Soft Matte Lip Cream',1050,'shade','{"shades":["Abu Dhabi","Cannes","Monte Carlo"]}',false,true,'Creamy, lightweight matte lip colour.'),
      ('superstay-matte-ink','cosmetics','maybelline','SuperStay Matte Ink',1500,'shade','{"shades":["Seductress","Lover","Ruler"]}',false,false,'Up to 16-hour liquid lipstick that will not budge.'),
      ('fenty-gloss-bomb','cosmetics','fenty-beauty','Gloss Bomb Lip Luminizer',3200,'single','{"shade":"Fenty Glow"}',true,false,'The universal lip gloss with a non-sticky shine.'),
      ('loreal-lash-paradise-mascara','cosmetics','loreal-paris','Lash Paradise Mascara',1650,'single','{"shade":"Blackest Black"}',false,false,'Volumising mascara for soft, full lashes.'),
      ('nyx-epic-ink-liner','cosmetics','nyx','Epic Ink Liner',1250,'single','{"shade":"Black"}',false,false,'Waterproof felt-tip liner for sharp wings.'),
      ('velvet-setting-powder','cosmetics','sparkle-signature','Velvet Setting Powder',1800,'shade','{"shades":["Light","Medium","Deep"]}',false,false,'Finely milled powder that sets makeup without flashback.'),
      ('flawless-concealer-pen','cosmetics','sparkle-signature','Flawless Concealer Pen',1350,'shade','{"shades":["Caramel","Espresso","Mocha"]}',false,false,'Brightening concealer with a click-pen applicator.'),
      ('nude-glam-eyeshadow-palette','cosmetics','sparkle-signature','Nude Glam Eyeshadow Palette',2800,'single','{"size":"12 shades"}',false,true,'Twelve warm nudes in matte and shimmer finishes.'),
      ('blush-duo','cosmetics','sparkle-signature','Rose Glow Blush Duo',1600,'single','{"shade":"Rose & Berry"}',false,false,'Buildable blush duo for a natural flush.'),
      ('bright-glow-serum','skincare','sparkle-signature','Bright Glow Serum',2800,'single','{"size":"30ml"}',true,false,'Vitamin C and niacinamide serum for even, glowing skin.'),
      ('cerave-hydrating-cleanser','skincare','cerave','Hydrating Facial Cleanser',2300,'single','{"size":"236ml"}',false,false,'Gentle, non-foaming cleanser with ceramides.'),
      ('cerave-moisturising-cream','skincare','cerave','Moisturising Cream',2900,'single','{"size":"340g"}',false,false,'Rich cream that restores the skin barrier.'),
      ('ordinary-niacinamide-zinc','skincare','the-ordinary','Niacinamide 10% + Zinc 1%',1600,'single','{"size":"30ml"}',false,false,'Reduces the look of blemishes and congestion.'),
      ('nivea-soft-cream','skincare','nivea','Soft Moisturising Cream',650,'single','{"size":"200ml"}',false,false,'Light all-over moisturiser for face, body and hands.'),
      ('garnier-vitamin-c-serum','skincare','garnier','Bright Complete Vitamin C Serum',1450,'single','{"size":"30ml"}',false,true,'Brightening serum for dark spots.'),
      ('shea-butter-body-lotion','skincare','sparkle-signature','Shea Butter Body Lotion',900,'single','{"size":"400ml"}',false,false,'Deeply nourishing lotion with raw shea butter.'),
      ('spf50-sunscreen-gel','skincare','sparkle-signature','SPF 50 Sunscreen Gel',1950,'single','{"size":"50ml"}',false,false,'Invisible sunscreen gel, no white cast on melanin-rich skin.'),
      ('rose-water-toner','skincare','sparkle-signature','Rose Water Toner',850,'single','{"size":"200ml"}',false,false,'Refreshing, alcohol-free toner.'),
      ('african-black-soap-face-wash','skincare','sparkle-signature','African Black Soap Face Wash',750,'single','{"size":"150ml"}',false,false,'Deep-cleansing face wash with black soap and tea tree.'),
      ('lattafa-khamrah','perfumes','lattafa','Khamrah Eau de Parfum',4500,'size','{"notes":"Cinnamon, dates, praline"}',true,false,'Warm, sweet and spicy. A long-lasting evening favourite.'),
      ('vs-bombshell','perfumes','victorias-secret','Bombshell Eau de Parfum',9500,'size','{"notes":"Passion fruit, peony, vanilla orchid"}',false,false,'Bright, flirty floral.'),
      ('armaf-club-de-nuit-woman','perfumes','armaf','Club de Nuit Woman',4800,'size','{"notes":"Rose, jasmine, patchouli"}',false,true,'Elegant floral chypre with excellent projection.'),
      ('velvet-rose-body-mist','perfumes','sparkle-signature','Velvet Rose Body Mist',1200,'single','{"size":"250ml"}',false,false,'Light rose body mist for everyday freshness.'),
      ('lattafa-yara','perfumes','lattafa','Yara Eau de Parfum',3900,'size','{"notes":"Orchid, heliotrope, vanilla"}',false,false,'Soft, creamy and powdery. Very popular.'),
      ('vanilla-musk-perfume-oil','perfumes','sparkle-signature','Vanilla Musk Perfume Oil',1100,'single','{"size":"12ml roll-on"}',false,false,'Alcohol-free perfume oil that lasts all day.'),
      ('satin-bonnet','accessories','sparkle-signature','Satin Sleep Bonnet',650,'single','{"color":"Blush Pink"}',false,false,'Protects hair and wigs overnight.'),
      ('silk-pillowcase','accessories','sparkle-signature','Mulberry Silk Pillowcase',1800,'single','{"color":"Champagne"}',false,false,'Reduces breakage and frizz while you sleep.'),
      ('wig-stand-mannequin','accessories','sparkle-signature','Wig Stand Mannequin Head',1500,'single','{"size":"22\""}',false,false,'Canvas block head for styling and storing wigs.'),
      ('wide-tooth-detangling-comb','accessories','sparkle-signature','Wide Tooth Detangling Comb',350,'single','{}',false,false,'Gentle detangling for curls and wigs.'),
      ('makeup-brush-set','accessories','sparkle-signature','Pro Makeup Brush Set (12 pcs)',2500,'single','{}',false,false,'Soft synthetic brushes for face and eyes, with pouch.'),
      ('beauty-blender-duo','accessories','sparkle-signature','Beauty Sponge Duo',700,'single','{}',false,false,'Latex-free blending sponges for a flawless base.'),
      ('edge-brush-duo','accessories','sparkle-signature','Edge Brush Duo',300,'single','{}',false,false,'Dual-ended brush for laying edges.')
    ) as t(slug, cat, brand, name, price, kind, attrs, featured, on_offer, description)
  loop
    insert into public.products (category_id, brand_id, name, slug, description, is_featured, rating, review_count, created_at)
    values ((select id from public.categories where slug = v_prod.cat), (select id from public.brands where slug = v_prod.brand),
            v_prod.name, v_prod.slug, v_prod.description, v_prod.featured,
            round((4.2 + random() * 0.8)::numeric, 1), 12 + floor(random() * 300)::int,
            now() - (floor(random() * 120) * interval '1 day'))
    returning id into v_pid;

    v_opts := case v_prod.kind
      when 'wig' then '[{"name":"14\"","length":"14\"","m":1},{"name":"18\"","length":"18\"","m":1.2},{"name":"22\"","length":"22\"","m":1.45}]'::jsonb
      when 'length' then '[{"name":"16\"","length":"16\"","m":1},{"name":"20\"","length":"20\"","m":1.25},{"name":"24\"","length":"24\"","m":1.5}]'::jsonb
      when 'braid' then '[{"name":"1B Natural Black","color":"1B Natural Black","m":1},{"name":"27 Honey Blonde","color":"27 Honey Blonde","m":1},{"name":"30 Auburn","color":"30 Auburn","m":1}]'::jsonb
      when 'size' then '[{"name":"50ml","size":"50ml","m":1},{"name":"100ml","size":"100ml","m":1.6}]'::jsonb
      when 'shade' then (select jsonb_agg(jsonb_build_object('name', s, 'shade', s, 'm', 1)) from jsonb_array_elements_text(v_prod.attrs::jsonb->'shades') s)
      else '[{"name":null,"m":1}]'::jsonb end;

    v_n := 0;
    for v_opt in select * from jsonb_array_elements(v_opts) loop
      v_n := v_n + 1;
      v_barcode := v_barcode + 1;
      insert into public.product_variants (product_id, sku, barcode, name, color, shade, size, hair_length, hair_texture, hair_type, hair_style)
      values (v_pid,
              upper(left(regexp_replace(v_prod.slug, '[^a-z0-9]', '', 'g'), 10)) || '-' || v_n,
              '616' || lpad(v_barcode::text, 10, '0'),
              v_opt->>'name',
              coalesce(v_opt->>'color', v_prod.attrs::jsonb->>'color'),
              coalesce(v_opt->>'shade', v_prod.attrs::jsonb->>'shade'),
              coalesce(v_opt->>'size', v_prod.attrs::jsonb->>'size'),
              coalesce(v_opt->>'length', v_prod.attrs::jsonb->>'length'),
              v_prod.attrs::jsonb->>'texture', v_prod.attrs::jsonb->>'type', v_prod.attrs::jsonb->>'style')
      returning id into v_vid;
      v_price := round(v_prod.price * (v_opt->>'m')::numeric / 50) * 50;
      insert into public.product_prices (variant_id, tier_id, amount, compare_at_amount)
      values (v_vid, v_retail, v_price, case when v_prod.on_offer then round(v_price * 1.25 / 50) * 50 end),
             (v_vid, v_wholesale, round(v_price * 0.75 / 50) * 50, null);
      insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level)
      values (v_vid, v_loc, 10 + floor(random() * 30)::int, case when v_prod.cat in ('braids') then 10 else 5 end);
    end loop;
  end loop;

  -- Stock situations the demo relies on.
  update public.inventory_levels l set quantity = x.qty
  from (values ('BRIGHTGLOW-1', 6), ('HAIRGROWTH-1', 4), ('BRAZILIANB-2', 3), ('FENTYPROFI-2', 2),
               ('BODYWAVELA-3', 2), ('EDGECONTRO-1', 3), ('LATTAFAYAR-2', 0), ('CURLYBANGF-1', 0),
               ('DARLINGSUP-1', 120), ('DARLINGSUP-2', 60), ('DARLINGSUP-3', 45), ('XPRESSIONU-1', 90),
               ('BODYWAVELA-1', 9), ('BODYWAVELA-2', 7)) x(sku, qty), public.product_variants v
  where v.sku = x.sku and l.variant_id = v.id;

  insert into public.promotions (name, code, description, discount_type, discount_value, starts_at, ends_at, minimum_order_amount, is_active) values
    ('Sparkle 10% Off', 'SPARKLE10', '10% off orders over KES 3,000', 'percentage', 10, now() - interval '10 days', now() + interval '20 days', 3000, true),
    ('Wig Week', 'WIGWEEK', 'KES 1,500 off orders over KES 15,000', 'fixed', 1500, now() - interval '2 days', now() + interval '5 days', 15000, true),
    ('July Glow', 'JULYGLOW', '15% off skincare (ended)', 'percentage', 15, now() - interval '120 days', now() - interval '90 days', 2000, false);

  -- Historical orders ----------------------------------------------------------------
  for i in reverse 30..1 loop
    v_at := case when v_days[i] = 0 then now() - ((1 + i) * interval '47 minutes')
                 else date_trunc('day', now()) - (v_days[i] * interval '1 day') + ((9 + floor(random() * 10)) * interval '1 hour') end;
    v_is_wholesale := i in (9, 18, 27);
    v_channel := case when v_is_wholesale or i % 3 = 2 then 'pos' else 'online' end;
    v_customer := case
      when v_is_wholesale then v_wholesale_ids[1 + (i / 9) - 1]
      when i in (10, 16, 25) then v_grace
      when v_channel = 'pos' and i % 2 = 0 then null
      else v_retail_ids[2 + ((i * 7) % 19)] end;
    v_status := case
      when v_channel = 'pos' then 'completed'
      when i = 1 then 'pending' when i = 3 then 'confirmed' when i = 4 then 'paid' when i = 6 then 'processing'
      when i = 7 then 'packed' when i = 12 then 'delivered' when i = 13 then 'dispatched' when i = 21 then 'cancelled'
      else 'completed' end;
    v_method := case when v_channel = 'pos' then (array['mpesa','cash','card','mpesa']::public.payment_method[])[1 + i % 4]
                     else (array['mpesa','mpesa','card','cash']::public.payment_method[])[1 + i % 4] end;
    if i in (1, 3) then v_method := 'mpesa'; end if;

    select full_name, phone, email into v_profile from public.profiles where id = v_customer;
    v_number := 'SPK-' || nextval('public.order_number_seq');
    insert into public.orders (order_number, customer_id, channel, status, payment_status, pricing_tier_id, delivery_method,
                               shipping_address, customer_name, customer_phone, customer_email, created_by, created_at, updated_at)
    values (v_number, v_customer, v_channel, v_status, 'pending', case when v_is_wholesale then v_wholesale else v_retail end,
            case when v_channel = 'pos' or i % 5 = 0 then 'pickup' else 'delivery' end,
            case when v_channel = 'online' and i % 5 <> 0 then
              (select jsonb_build_object('address_line1', a.address_line1, 'city', a.city, 'county', a.county)
               from public.customer_addresses a where a.user_id = v_customer limit 1) end,
            coalesce(v_profile.full_name, 'Walk-in customer'), v_profile.phone, v_profile.email,
            case when v_channel = 'pos' then v_staff end, v_at, v_at)
    returning id into v_order;

    v_cats := case when v_customer = v_grace then array['wigs','extensions','hair-care','skincare']
                   when v_is_wholesale then array['braids','hair-care','cosmetics']
                   else null end;
    v_items := case when v_is_wholesale then 3 else 1 + floor(random() * 3)::int end;
    v_sub := 0;
    for v_line in
      select v.id, v.product_id, p.name || coalesce(' – ' || v.name, '') as name, v.sku,
             coalesce(tp.amount, rp.amount) as amount
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
      join public.inventory_levels l on l.variant_id = v.id
      join public.product_prices rp on rp.variant_id = v.id and rp.tier_id = v_retail
      left join public.product_prices tp on tp.variant_id = v.id and tp.tier_id = case when v_is_wholesale then v_wholesale else v_retail end
      where l.quantity >= 10 and (v_cats is null or c.slug = any(v_cats))
        and v.sku not like 'BRIGHTGLOW%'
      order by random()
      limit v_items
    loop
      v_qty := case when v_is_wholesale then 6 + floor(random() * 7)::int when random() < 0.8 then 1 else 2 end;
      insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total)
      values (v_order, v_line.id, v_line.product_id, v_line.name, v_line.sku, v_qty, v_line.amount, v_line.amount * v_qty);
      v_sub := v_sub + v_line.amount * v_qty;
      if v_status in ('pending','confirmed','paid','processing','packed') then
        update public.inventory_levels set reserved = reserved + v_qty where variant_id = v_line.id and location_id = v_loc;
      end if;
    end loop;

    -- Bright Glow Serum sells about one a day over the last two weeks (drives the stock insight).
    if i in (10, 11, 14, 15, 16, 17, 19) then
      insert into public.order_items (order_id, variant_id, product_id, product_name, sku, quantity, unit_price, line_total)
      select v_order, v.id, v.product_id, p.name, v.sku, 2, pp.amount, pp.amount * 2
      from public.product_variants v join public.products p on p.id = v.product_id
      join public.product_prices pp on pp.variant_id = v.id and pp.tier_id = v_retail
      where v.sku = 'BRIGHTGLOW-1';
      v_sub := v_sub + 2 * (select pp.amount from public.product_prices pp join public.product_variants v on v.id = pp.variant_id
                            where v.sku = 'BRIGHTGLOW-1' and pp.tier_id = v_retail);
    end if;

    v_fee := case when v_channel = 'pos' or i % 5 = 0 then 0 when v_sub >= 10000 then 0
                  when (select shipping_address->>'city' from public.orders where id = v_order) = 'Nairobi' then 300 else 500 end;
    v_total := v_sub + v_fee;
    update public.orders set subtotal = v_sub, delivery_amount = v_fee, total_amount = v_total,
           payment_status = case when v_status = 'cancelled' then 'refunded'::public.payment_status
                                 when v_method = 'cash' and v_status in ('pending','confirmed') then 'pending'::public.payment_status
                                 else 'paid'::public.payment_status end
    where id = v_order;
    insert into public.payments (order_id, method, status, amount, provider_reference, paid_at, created_at)
    select v_order, v_method, o.payment_status, v_total,
           case when o.payment_status = 'pending' then null
                when v_method = 'mpesa' then public.mpesa_reference()
                when v_method = 'card' then 'CARD-' || upper(substr(md5(v_number), 1, 8))
                else 'CASH-' || upper(substr(md5(v_number), 1, 6)) end,
           case when o.payment_status = 'pending' then null else v_at + interval '2 minutes' end, v_at
    from public.orders o where o.id = v_order;

    -- Timeline: one event per lifecycle step reached, spaced through the day(s).
    if v_channel = 'pos' then
      insert into public.order_events (order_id, status, note, created_by, created_at)
      values (v_order, 'completed', 'In-store sale (' || case when v_is_wholesale then 'Wholesale' else 'Retail' end || ')', v_staff, v_at);
    elsif v_status = 'cancelled' then
      insert into public.order_events (order_id, status, note, created_by, created_at) values
        (v_order, 'pending', 'Order placed online', v_customer, v_at),
        (v_order, 'cancelled', 'Customer asked to cancel', v_staff, v_at + interval '3 hours');
    else
      for v_s in 1..array_position(v_flow, v_status) loop
        insert into public.order_events (order_id, status, note, created_by, created_at)
        values (v_order, v_flow[v_s], case when v_s = 1 then 'Order placed online' end,
                case when v_s = 1 then v_customer else v_admin end,
                least(now() - interval '5 minutes', v_at + ((v_s - 1) * interval '5 hours')));
      end loop;
    end if;
    update public.orders set updated_at = (select max(created_at) from public.order_events where order_id = v_order) where id = v_order;
  end loop;

  -- Loyalty: welcome bonus plus 1 point per KES 100 on completed retail orders.
  insert into public.loyalty_transactions (customer_id, points, reason, created_at)
  select p.id, 100, 'Welcome bonus', p.created_at from public.profiles p
  where p.id = any(v_retail_ids);
  insert into public.loyalty_transactions (customer_id, order_id, points, reason, created_at)
  select o.customer_id, o.id, floor(o.total_amount / 100), 'Earned on order ' || o.order_number, o.updated_at
  from public.orders o
  where o.status = 'completed' and o.customer_id = any(v_retail_ids) and o.pricing_tier_id = v_retail;
  update public.profiles p set loyalty_points = coalesce((select sum(points) from public.loyalty_transactions t where t.customer_id = p.id), 0)
  where p.id = any(v_retail_ids || v_wholesale_ids);

  insert into public.customer_notes (customer_id, note, created_by, created_at) values
    (v_grace, 'Prefers body wave textures, 18" length. Likes WhatsApp updates.', v_admin, now() - interval '20 days'),
    ('c0000000-0000-4000-8000-000000000101', 'Salon owner. Restocks Darling braids every two weeks.', v_admin, now() - interval '30 days');

  insert into public.notifications (user_id, title, body, link, read_at, created_at)
  select o.customer_id, 'Order update', 'Order ' || o.order_number || ' is complete. Thank you for shopping with Sparkle!',
         '/order/' || o.order_number, now(), o.updated_at
  from public.orders o where o.customer_id = v_grace and o.status = 'completed';

  insert into public.wishlists (user_id) values (v_grace);
  insert into public.wishlist_items (wishlist_id, product_id)
  select w.id, p.id from public.wishlists w, public.products p
  where w.user_id = v_grace and p.slug in ('honey-blonde-body-wave-wig', 'lattafa-khamrah');
end;
$$;

revoke execute on function public.demo_seed() from public, anon, authenticated;

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
  insert into public.activity_log (actor_id, action, details) values (auth.uid(), 'demo.reset', '{}'::jsonb);
end;
$$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

-- Load the demo data now.
select public.demo_seed();
