// Loads the UltimatePOS products into Sparkle, exactly as proposed in the review workbook.
//
//   node scripts/migration/ultimatepos-import.mjs <export.xlsx> <out-dir>
//
// Writes two SQL files into <out-dir> (use products/, which is git-ignored):
//   import-dryrun.sql  runs everything, then raises an exception with the counts, so nothing is kept
//   import-apply.sql   the same in one transaction that commits
// Run them with: supabase db query --linked -f <file>
//
// What it does (Nicholas, 2026-11-11):
//   - prices copied unchanged: they include VAT, which is how Sparkle now prices (migration 20261111120000);
//   - demo stock of 10 per variant at Main Store, so the shop and till can be tried. NOT real stock:
//     replace it with a stock count before go-live;
//   - the demo products are hidden (not deleted: old orders refer to them);
//   - non-product rows (test item, fixtures, delivery service) are not imported;
//   - every product is shown, including likely prescription medicines and the injectable (Nicholas,
//     2026-11-12); their compliance warnings stay in the review workbook;
//   - products no rule matched get a hand-chosen category (MANUAL_CATEGORIES in the proposal);
//   - old POS SKU becomes the barcode (the shop's printed labels scan); the second of a duplicated
//     old SKU gets no barcode.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_SLUG, productSlug, propose, title } from "./ultimatepos-proposal.mjs";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) { console.error("usage: node scripts/migration/ultimatepos-import.mjs <export.xlsx> <out-dir>"); process.exit(1); }

const DEMO_STOCK = 10;
const REORDER_LEVEL = 2;
const NEW_CATEGORIES = [
  { slug: "nails", name: "Nails", parent: "cosmetics", sort: 1 },
  { slug: "makeup", name: "Makeup", parent: "cosmetics", sort: 2 },
  { slug: "personal-care", name: "Personal Care", parent: null, sort: 6 },
  { slug: "health-wellness", name: "Health & Wellness", parent: null, sort: 7 },
];
/** "Shop by Brands" row: real brands with products (L'Oréal and Maybelline are not in the catalogue). */
const FEATURED_BRANDS = ["Garnier", "Nivea", "Vaseline", "Dark & Lovely"];

/** "1/BLUE" → "1/Blue", "GREEN/30/PINK" → "Green/30/Pink"; hair codes (1B, F1B, 99J) stay as they are. */
const prettyColour = (c) => c.split(/(\/| \| | )/).map((p) => (/^[A-Z]{3,}$/.test(p) ? title(p) : p)).join("");

const { rows, parents } = propose(readFileSync(input));
const skuSeen = new Set();
const products = [];
const variants = [];
for (const p of parents) {
  const members = p.members;
  const categorySlug = p.category ? CATEGORY_SLUG[`${p.category}|${p.subcategory}`] : null;
  if (p.category && !categorySlug) throw new Error(`No category slug for ${p.category} | ${p.subcategory}`);
  products.push({ code: p.code, name: p.name, slug: productSlug(p), brand: p.brand || null, category_slug: categorySlug, is_active: true });
  const labels = new Map();
  for (const m of members) {
    const colour = m.colour ? prettyColour(m.colour) : null;
    const size = m.size || m.pack || null;
    const single = members.length === 1;
    // Variant name in the form the product editor reads back (app/admin/products/[id]/edit/page.tsx).
    let name = null;
    if (!single) {
      if (colour && m.length && !m.size && !m.shade && !m.pack) name = `${colour} · ${m.length}`;
      else if (colour && size && !m.length && !m.shade) name = `${colour} · ${size}`;
      else name = [colour, m.shade, m.length, size].filter(Boolean).join(" · ") || "Standard";
      const n = (labels.get(name) ?? 0) + 1;
      labels.set(name, n);
      if (n > 1) name = `${name} (${m.oldSku})`;
    }
    const barcode = skuSeen.has(m.oldSku) ? null : m.oldSku;
    skuSeen.add(m.oldSku);
    variants.push({ code: p.code, sku: m.variantSku, barcode, name, color: colour, shade: m.shade || null, size, hair_length: m.length || null,
      cost: m.cost, price: m.sell, excel_row: m.excelRow });
  }
}
const skipped = rows.filter((r) => r.rowType !== "Product");

const json = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const body = `
-- Guard: never import twice.
do $$ begin
  if exists (select 1 from public.product_variants where sku in (select x->>'sku' from jsonb_array_elements(${json(variants.map((v) => ({ sku: v.sku })))}) x)) then
    raise exception 'These products are already imported';
  end if;
end $$;

create temp table imp_products on commit drop as
  select * from jsonb_to_recordset(${json(products)}) as x(code text, name text, slug text, brand text, category_slug text, is_active boolean);
create temp table imp_variants on commit drop as
  select * from jsonb_to_recordset(${json(variants)}) as x(code text, sku text, barcode text, name text, color text, shade text, size text, hair_length text, cost numeric, price numeric, excel_row int);

-- New categories
insert into public.categories (name, slug, parent_id, sort_order)
select n.name, n.slug, (select id from public.categories where slug = n.parent), n.sort
from jsonb_to_recordset(${json(NEW_CATEGORIES)}) as n(slug text, name text, parent text, sort int)
on conflict do nothing;

-- Brands that don't exist yet
insert into public.brands (name, slug)
select distinct brand, regexp_replace(regexp_replace(lower(replace(brand, '&', ' and ')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
from imp_products where brand is not null
on conflict do nothing;

-- Hide the demo catalogue (kept: old orders refer to it)
update public.products set is_active = false where is_active;

insert into public.products (name, slug, brand_id, category_id, is_active, tax_type)
select p.name, p.slug, b.id, c.id, p.is_active, 'B'
from imp_products p left join public.brands b on b.name = p.brand left join public.categories c on c.slug = p.category_slug;

insert into public.product_variants (product_id, sku, barcode, name, color, shade, size, hair_length, cost_price, is_active)
select pr.id, v.sku,
       case when exists (select 1 from public.product_variants x where x.barcode = v.barcode) then null else v.barcode end,
       v.name, v.color, v.shade, v.size, v.hair_length, v.cost, true
from imp_variants v join imp_products p on p.code = v.code join public.products pr on pr.slug = p.slug;

insert into public.product_prices (variant_id, tier_id, amount)
select pv.id, (select id from public.pricing_tiers where code = 'retail'), v.price
from imp_variants v join public.product_variants pv on pv.sku = v.sku;

-- DEMO STOCK (not real quantities): ${DEMO_STOCK} per variant so the shop and till can be tried.
insert into public.inventory_levels (variant_id, location_id, quantity, reorder_level)
select pv.id, (select id from public.inventory_locations where name = 'Main Store'), ${DEMO_STOCK}, ${REORDER_LEVEL}
from imp_variants v join public.product_variants pv on pv.sku = v.sku;

update public.brands set featured_rank = null where featured_rank is not null;
update public.brands b set featured_rank = f.rank
from jsonb_to_recordset(${json(FEATURED_BRANDS.map((name, i) => ({ name, rank: i + 1 })))}) as f(name text, rank int) where b.name = f.name;
`;

const checks = `
do $$
declare r text;
begin
  select format('products %s (active %s, no category %s) | variants %s | prices %s | stock rows %s (qty %s) | barcodes %s | price total %s | cost total %s | demo products still active %s | featured %s',
    (select count(*) from public.products p join imp_products i on i.slug = p.slug),
    (select count(*) from public.products p join imp_products i on i.slug = p.slug where p.is_active),
    (select count(*) from public.products p join imp_products i on i.slug = p.slug where p.category_id is null),
    (select count(*) from public.product_variants pv join imp_variants v on v.sku = pv.sku),
    (select count(*) from public.product_prices pp join public.product_variants pv on pv.id = pp.variant_id join imp_variants v on v.sku = pv.sku),
    (select count(*) from public.inventory_levels il join public.product_variants pv on pv.id = il.variant_id join imp_variants v on v.sku = pv.sku),
    (select sum(il.quantity) from public.inventory_levels il join public.product_variants pv on pv.id = il.variant_id join imp_variants v on v.sku = pv.sku),
    (select count(pv.barcode) from public.product_variants pv join imp_variants v on v.sku = pv.sku),
    (select sum(pp.amount) from public.product_prices pp join public.product_variants pv on pv.id = pp.variant_id join imp_variants v on v.sku = pv.sku),
    (select sum(pv.cost_price) from public.product_variants pv join imp_variants v on v.sku = pv.sku),
    (select count(*) from public.products p where p.is_active and not exists (select 1 from imp_products i where i.slug = p.slug)),
    (select string_agg(name, ', ' order by featured_rank) from public.brands where featured_rank is not null))
  into r;
  raise %s 'RESULT %', r;
end $$;
`;
writeFileSync(join(outDir, "import-dryrun.sql"), body + checks.replace("raise %s", "raise exception"));
writeFileSync(join(outDir, "import-apply.sql"), `begin;\n${body}${checks.replace("raise %s", "raise notice")}commit;\n`);

const expected = { products: products.length, active: products.filter((p) => p.is_active).length, noCategory: products.filter((p) => !p.category_slug).length,
  variants: variants.length, barcodes: variants.filter((v) => v.barcode).length,
  priceTotal: Math.round(variants.reduce((s, v) => s + v.price, 0) * 100) / 100, costTotal: Math.round(variants.reduce((s, v) => s + v.cost, 0) * 100) / 100,
  skippedRows: skipped.map((r) => `${r.excelRow} ${r.rawName}`) };
console.log(JSON.stringify(expected, null, 1));
