-- Demo product photography. One Unsplash photo (free licence: unsplash.com/license) per
-- product, chosen to match its type, stored in products.image_urls (base URL; the app adds
-- size parameters). demo_images() reapplies them after demo_seed(), and reset_demo() now
-- calls both. Replace with real product photos when available.

create or replace function public.demo_images()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.products p
  set image_urls = array[v.url]
  from (values
    ('body-wave-lace-front-wig', 'https://images.unsplash.com/photo-1645736279976-59f8fd22720c'),
    ('straight-bone-lace-front-wig', 'https://images.unsplash.com/photo-1724128190202-80ce103d74f5'),
    ('deep-wave-closure-wig', 'https://images.unsplash.com/photo-1633257245586-9addcf688fbe'),
    ('kinky-curly-afro-wig', 'https://images.unsplash.com/photo-1664293370166-83df50ff4692'),
    ('honey-blonde-body-wave-wig', 'https://images.unsplash.com/photo-1663582816158-42354522fe15'),
    ('water-wave-headband-wig', 'https://images.unsplash.com/photo-1656473031949-5541282f05a4'),
    ('ombre-highlight-straight-wig', 'https://images.unsplash.com/photo-1782132033904-316a21ef3160'),
    ('pixie-bob-lace-wig', 'https://images.unsplash.com/photo-1611432579699-484f7990b127'),
    ('afro-puff-drawstring-ponytail', 'https://images.unsplash.com/photo-1707162740897-cf2f057d2a41'),
    ('body-wave-clip-in-ponytail', 'https://images.unsplash.com/photo-1707914882389-c5ff15b51e97'),
    ('curly-bang-fringe', 'https://images.unsplash.com/photo-1588527962980-72746d95973e'),
    ('bun-chignon-piece', 'https://images.unsplash.com/photo-1771430908177-7cde60c1e070'),
    ('straight-lace-closure-4x4', 'https://images.unsplash.com/photo-1769029257460-7052dc5c1731'),
    ('darling-super-star-braid', 'https://images.unsplash.com/photo-1606416132922-22ab37c1231e'),
    ('xpression-ultra-braid', 'https://images.unsplash.com/photo-1614173968962-0e61c5ed196f'),
    ('pre-stretched-braiding-hair', 'https://images.unsplash.com/photo-1638794249638-b97e05aaa900'),
    ('passion-twist-crochet-hair', 'https://images.unsplash.com/photo-1592328906746-0a3ca0bde253'),
    ('butterfly-locs-crochet', 'https://images.unsplash.com/photo-1594254773847-9fce26e950bc'),
    ('knotless-goddess-braid-hair', 'https://images.unsplash.com/photo-1769694609721-98f8bab9735a'),
    ('magic-hair-afro-kinky-bulk', 'https://images.unsplash.com/photo-1656473031961-9d5d9ee19f40'),
    ('brazilian-body-wave-bundle', 'https://images.unsplash.com/photo-1560869713-bf165a9cfac1'),
    ('peruvian-straight-bundle', 'https://images.unsplash.com/photo-1747398690600-ffe8ecda9df1'),
    ('malaysian-deep-wave-bundle', 'https://images.unsplash.com/photo-1560264641-1b5191cc63e2'),
    ('clip-in-straight-extensions', 'https://images.unsplash.com/photo-1785456439444-5132a64f0dd7'),
    ('tape-in-extensions', 'https://images.unsplash.com/photo-1785456390070-9960e3997066'),
    ('hair-growth-oil', 'https://images.unsplash.com/photo-1643123158858-eac2aabaa1ec'),
    ('curl-enhancing-smoothie', 'https://images.unsplash.com/photo-1643123158477-0c3f990b299d'),
    ('leave-in-conditioner', 'https://images.unsplash.com/photo-1643123158489-634259c983b3'),
    ('edge-control-gel', 'https://images.unsplash.com/photo-1643123158509-b07b9fd5e802'),
    ('wig-bond-adhesive', 'https://images.unsplash.com/photo-1667242003572-96caaf8ac5c4'),
    ('heat-protectant-spray', 'https://images.unsplash.com/photo-1643123158523-2950acbdfd68'),
    ('fenty-pro-filtr-foundation', 'https://images.unsplash.com/photo-1627885793933-584e53987c14'),
    ('fit-me-matte-foundation', 'https://images.unsplash.com/photo-1654973433534-1238e06f6b38'),
    ('black-opal-true-color-foundation', 'https://images.unsplash.com/photo-1599733589046-10c005739ef9'),
    ('nyx-matte-lipstick', 'https://images.unsplash.com/photo-1591360236480-4ed861025fa1'),
    ('superstay-matte-ink', 'https://images.unsplash.com/photo-1760860992755-c432351d47e9'),
    ('fenty-gloss-bomb', 'https://images.unsplash.com/photo-1631214524115-9942bf927d4a'),
    ('loreal-lash-paradise-mascara', 'https://images.unsplash.com/photo-1650664370914-f026578ec2a4'),
    ('nyx-epic-ink-liner', 'https://images.unsplash.com/photo-1631214540553-ff044a3ff1d4'),
    ('velvet-setting-powder', 'https://images.unsplash.com/photo-1531646317777-0619c7c5d1d3'),
    ('flawless-concealer-pen', 'https://images.unsplash.com/photo-1566733015703-b89a6389ff18'),
    ('nude-glam-eyeshadow-palette', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796'),
    ('blush-duo', 'https://images.unsplash.com/photo-1550281378-521929a11c42'),
    ('bright-glow-serum', 'https://images.unsplash.com/photo-1586212653598-40f9046fe5e3'),
    ('cerave-hydrating-cleanser', 'https://images.unsplash.com/photo-1585652757173-57de5e9fab42'),
    ('cerave-moisturising-cream', 'https://images.unsplash.com/photo-1768235146463-328c98e7234d'),
    ('ordinary-niacinamide-zinc', 'https://images.unsplash.com/photo-1643379852776-308d9bbf8645'),
    ('nivea-soft-cream', 'https://images.unsplash.com/photo-1585652757146-e9d00bf2810c'),
    ('garnier-vitamin-c-serum', 'https://images.unsplash.com/photo-1599022484220-967921f2217c'),
    ('shea-butter-body-lotion', 'https://images.unsplash.com/photo-1643123158622-cd757dce7cfa'),
    ('spf50-sunscreen-gel', 'https://images.unsplash.com/photo-1770795469594-768039ef6650'),
    ('rose-water-toner', 'https://images.unsplash.com/photo-1585652757141-8837d676fac8'),
    ('african-black-soap-face-wash', 'https://images.unsplash.com/photo-1643123158319-034f6a10aff9'),
    ('lattafa-khamrah', 'https://images.unsplash.com/photo-1613521140785-e85e427f8002'),
    ('vs-bombshell', 'https://images.unsplash.com/photo-1458538977777-0549b2370168'),
    ('armaf-club-de-nuit-woman', 'https://images.unsplash.com/photo-1585218356022-6a53145f56f6'),
    ('velvet-rose-body-mist', 'https://images.unsplash.com/photo-1543422655-ac1c6ca993ed'),
    ('lattafa-yara', 'https://images.unsplash.com/photo-1676347929093-6614fb45bd90'),
    ('vanilla-musk-perfume-oil', 'https://images.unsplash.com/photo-1773527142304-58116364b8a1'),
    ('satin-bonnet', 'https://images.unsplash.com/photo-1776969824686-f3ccd3f53649'),
    ('silk-pillowcase', 'https://images.unsplash.com/photo-1745670457825-acdabc30498e'),
    ('wig-stand-mannequin', 'https://images.unsplash.com/photo-1642980553967-a0d41211b21c'),
    ('wide-tooth-detangling-comb', 'https://images.unsplash.com/photo-1774301844178-c9ce96b76d92'),
    ('makeup-brush-set', 'https://images.unsplash.com/photo-1453761816053-ed5ba727b5b7'),
    ('beauty-blender-duo', 'https://images.unsplash.com/photo-1631214499995-468422da65d4'),
    ('edge-brush-duo', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348')
  ) as v(slug, url)
  where p.slug = v.slug;
end;
$$;

revoke execute on function public.demo_images() from public, anon, authenticated;

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
  insert into public.activity_log (actor_id, action, details) values (auth.uid(), 'demo.reset', '{}'::jsonb);
end;
$$;

revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

select public.demo_images();
