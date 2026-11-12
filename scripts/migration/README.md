# Product migration scripts

Scripts for moving Sparkle's products from the old UltimatePOS into this system. **They never write to the database.**

The real exports and the workbooks these scripts produce contain cost prices, so they live in `products/`. That folder is git-ignored; never commit it.

## Review workbook (stage 2)

```bash
node scripts/migration/ultimatepos-review.mjs products/<export>.xlsx products/Sparkle-product-migration-review.xlsx
```

The script reads the UltimatePOS product export and writes a workbook for people to check. It keeps every original row and shows what it proposes for each one:

- the parent product, brand, category and subcategory;
- colour, shade, length, size and pack;
- the old and proposed codes;
- cost, selling price and locations;
- every warning, graded Blocker, Check or Info.

Uncertain groupings are flagged, never guessed. The script stops with an error if any original row, cost or selling price fails to come through unchanged.

### What it deliberately doesn't do

- **Prices are copied as they are.** They include VAT, which is how Sparkle prices now.
- **No stock.** The export has no quantities.
- **No images.**

### Where the rules live

All the rules are at the top of `ultimatepos-review.mjs`: spelling fixes, the hand-checked brand list, category keywords, colour and length codes, and the compliance flags. Change a rule there, re-run the script, and review again.

`xlsx.mjs` is a small .xlsx reader and writer built on `fflate`.

## Import (stage 3)

```bash
node scripts/migration/ultimatepos-import.mjs products/<export>.xlsx products
supabase db query --linked -f products/import-dryrun.sql   # runs everything, reports the counts, keeps nothing
supabase db query --linked -f products/import-apply.sql    # one transaction
```

The rules come from `ultimatepos-proposal.mjs`, the same file the review uses, so what was reviewed is exactly what gets imported. The import:

- hides the demo products (old orders still refer to them);
- adds the Nails, Makeup, Personal Care and Health & Wellness categories and any missing brands;
- copies prices unchanged (they include VAT);
- uses the old POS SKU as the barcode, so the shop's printed labels scan;
- gives **demo stock of 10 per variant** at Main Store. This is not real stock: replace it with a count before go-live;
- skips the non-product rows;
- imports the likely prescription medicines and the injectable hidden;
- leaves products without a category out of the shop.

It refuses to run twice.
