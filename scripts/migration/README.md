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

- **Prices are copied as they are.** Whether the old prices include VAT is still an open question.
- **No stock.** The export has no quantities.
- **No images.**

### Where the rules live

All the rules are at the top of `ultimatepos-review.mjs`: spelling fixes, the hand-checked brand list, category keywords, colour and length codes, and the compliance flags. Change a rule there, re-run the script, and review again.

`xlsx.mjs` is a small .xlsx reader and writer built on `fflate`.
