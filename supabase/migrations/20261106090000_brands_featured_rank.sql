-- Brands shown in the Shop page's "Shop by Brands" row, in this order (null = not featured).
-- Nicholas chose the first four on 2026-11-03. Existing RLS on brands (public read, staff write) covers it.
alter table public.brands add column if not exists featured_rank smallint;

update public.brands b set featured_rank = v.rank
from (values ('L''Oréal Paris', 1), ('Garnier', 2), ('Nivea', 3), ('Maybelline', 4)) as v(name, rank)
where b.name = v.name;
