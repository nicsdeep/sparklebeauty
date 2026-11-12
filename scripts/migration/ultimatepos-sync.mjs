// Brings the imported products in the database in line with the current proposal rules:
// each product's category, and every Excel product shown (Nicholas, 2026-11-12).
//
//   node scripts/migration/ultimatepos-sync.mjs <export.xlsx> <out-dir>
//   supabase db query --linked -f <out-dir>/sync-dryrun.sql   # reports what would change, keeps nothing
//   supabase db query --linked -f <out-dir>/sync-apply.sql
//
// Products are matched by slug (it ends in the product code, e.g. "-ang-0323"), so it only touches
// imported products. It refuses to run unless every proposed product is found.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_SLUG, productSlug, propose } from "./ultimatepos-proposal.mjs";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) { console.error("usage: node scripts/migration/ultimatepos-sync.mjs <export.xlsx> <out-dir>"); process.exit(1); }

const { parents } = propose(readFileSync(input));
const wanted = parents.map((p) => {
  const category_slug = p.category ? CATEGORY_SLUG[`${p.category}|${p.subcategory}`] : null;
  if (p.category && !category_slug) throw new Error(`No category slug for ${p.category} | ${p.subcategory}`);
  return { slug: productSlug(p), category_slug };
});
const json = `'${JSON.stringify(wanted).replace(/'/g, "''")}'::jsonb`;

const body = `
create temp table sync_products on commit drop as
  select * from jsonb_to_recordset(${json}) as x(slug text, category_slug text);
do $$ declare missing int; begin
  select count(*) into missing from sync_products s where not exists (select 1 from public.products p where p.slug = s.slug);
  if missing > 0 then raise exception 'SYNC STOPPED: % proposed products are not in the database', missing; end if;
end $$;
create temp table sync_before on commit drop as
  select count(*) filter (where p.category_id is null) as no_category, count(*) filter (where not p.is_active) as hidden,
         count(*) filter (where p.category_id is distinct from c.id or not p.is_active) as to_change
  from sync_products s join public.products p on p.slug = s.slug left join public.categories c on c.slug = s.category_slug;
update public.products p set category_id = c.id, is_active = true, updated_at = now()
from sync_products s left join public.categories c on c.slug = s.category_slug
where p.slug = s.slug and (p.category_id is distinct from c.id or not p.is_active);
`;
const check = (raise) => `
do $$ declare r text; begin
  select format('before: no category %s, hidden %s, changed %s | after: imported %s, visible in shop %s, no category %s, hidden %s',
    b.no_category, b.hidden, b.to_change,
    (select count(*) from sync_products),
    (select count(*) from sync_products s join public.products p on p.slug = s.slug where p.is_active and p.category_id is not null),
    (select count(*) from sync_products s join public.products p on p.slug = s.slug where p.category_id is null),
    (select count(*) from sync_products s join public.products p on p.slug = s.slug where not p.is_active))
  into r from sync_before b;
  raise ${raise} 'RESULT %', r;
end $$;
`;
writeFileSync(join(outDir, "sync-dryrun.sql"), body + check("exception"));
writeFileSync(join(outDir, "sync-apply.sql"), `begin;\n${body}${check("notice")}commit;\n`);
console.log(JSON.stringify({ products: wanted.length, withCategory: wanted.filter((w) => w.category_slug).length }));
