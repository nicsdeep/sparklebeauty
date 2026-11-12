// Builds the human-review workbook for migrating the UltimatePOS product export into Sparkle.
//
//   node scripts/migration/ultimatepos-review.mjs <export.xlsx> <review.xlsx>
//
// It changes nothing anywhere: it reads the export and writes a workbook that keeps every original
// row and shows the proposed product, brand, category, variant options, codes and all warnings.
// Prices are copied as they are (they include VAT, as Sparkle now prices), stock is not touched
// (the export has no quantities) and images are left out. Uncertain groupings are flagged, not
// guessed. The data files stay in products/ (git-ignored: they hold real cost prices).
import { readFileSync, writeFileSync } from "node:fs";
import { STYLE, writeWorkbook } from "./xlsx.mjs";
import { propose } from "./ultimatepos-proposal.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) { console.error("usage: node scripts/migration/ultimatepos-review.mjs <export.xlsx> <review.xlsx>"); process.exit(1); }

// The rules live in ultimatepos-proposal.mjs.
const { header, C, original, rows, products, parents, RANK } = propose(readFileSync(input));

// ---------------------------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------------------------
const sev = (s) => ({ v: s, s: s === "Blocker" ? STYLE.red : s === "Check" ? STYLE.amber : s === "OK" ? STYLE.green : 0 });
const conf = (c) => ({ v: c, s: c === "Low" || c === "Not identified" ? STYLE.red : c === "Medium" ? STYLE.amber : c === "High" ? STYLE.green : 0 });
const money = (n) => ({ v: Number.isFinite(n) ? n : "", s: STYLE.money });
const dec = (n) => ({ v: n === null || !Number.isFinite(n) ? "" : Math.round(n * 10) / 10, s: STYLE.decimal });
const DECISIONS = ["Approve", "Change", "Remove", "Merge into another product", "Split out of this group"];

const reviewCols = [
  ["Export row", 9], ["Old POS SKU", 10], ["Original name (exact)", 38], ["Row type", 11], ["Proposed product code", 13], ["Proposed parent product", 34],
  ["Variant (options)", 24], ["Items in group", 8], ["Grouping confidence", 13], ["Option type", 14], ["Brand", 16], ["Brand confidence", 13],
  ["Category", 18], ["Subcategory", 16], ["Category confidence", 12], ["Colour", 14], ["Shade", 10], ["Length", 10], ["Size", 10], ["Pack", 12],
  ["Proposed variant SKU", 15], ["Old unit", 8], ["Cost (KES)", 10], ["Selling price (KES), unchanged", 13], ["Real markup %", 9], ["Old stated margin %", 9],
  ["Old VAT setting", 13], ["Locations (old POS)", 22], ["Spelling fixes", 22], ["Highest severity", 11], ["Warnings", 60], ["Review decision", 16], ["Reviewer notes", 30],
].map(([header, width]) => ({ header, width }));
const reviewRow = (r) => [
  r.excelRow, r.oldSku, r.rawName, r.rowType, r.parentCode ?? "", r.parentName ?? "", r.variantLabel ?? "", r.groupSize ?? "", r.groupConfidence ? conf(r.groupConfidence === "Single product" ? "" : r.groupConfidence) : "",
  r.optionType ?? "", r.brand, r.rowType === "Product" ? conf(r.brandConfidence) : "", r.category, r.subcategory, r.rowType === "Product" ? conf(r.categoryConfidence) : "",
  r.colour, r.shade, r.length, r.size, r.pack, r.variantSku ?? "", r.unit, money(r.cost), money(r.sell), dec(r.markup), dec(r.statedMargin), r.tax, r.locations,
  r.fixes.join(", "), sev(r.severity), { v: r.warningText, s: STYLE.wrap }, "", "",
];
const validations = [{ column: 31, list: DECISIONS }];

const count = (pred) => rows.filter(pred).length;
const bySev = (s) => count((r) => r.severity === s);
const readme = [
  "Sparkle product migration: review workbook",
  `Source: ${input.split(/[\\/]/).pop()} (UltimatePOS product export). Built ${new Date().toISOString().slice(0, 10)} by scripts/migration/ultimatepos-review.mjs.`,
  "",
  "WHAT THIS IS",
  "A proposal for review, not an import. Nothing has been changed in the old POS or in Sparkle.",
  `Every one of the ${rows.length} original rows is kept (sheet "Review (all rows)", one line per export row, in the original order; sheet "Original export" is the file exactly as received).`,
  "",
  "NOT DONE IN THIS STEP (on purpose)",
  "• Prices are copied exactly. They include VAT (confirmed by Nicholas, 2026-11-11), which is how Sparkle prices now, so no price is converted.",
  "• Stock is not included: the export has no quantities. A stock count is taken at go-live.",
  "• Images are not included (the export only has the default placeholder).",
  "",
  "SUMMARY",
  `Rows: ${rows.length} · products: ${products.length} · non-product rows: ${count((r) => r.rowType === "Non-product")}`,
  `Proposed parent products: ${parents.length} (${parents.filter((p) => p.members.length > 1).length} with variants, covering ${parents.filter((p) => p.members.length > 1).reduce((s, p) => s + p.members.length, 0)} rows; ${parents.filter((p) => p.members.length === 1).length} single products)`,
  `Grouping confidence: High ${parents.filter((p) => p.confidence === "High").length} · Medium ${parents.filter((p) => p.confidence === "Medium").length} · Low ${parents.filter((p) => p.confidence === "Low").length} groups`,
  `Rows by highest severity: Blocker ${bySev("Blocker")} · Check ${bySev("Check")} · Info ${bySev("Info")} · OK ${bySev("OK")}`,
  `Brand identified: ${count((r) => r.rowType === "Product" && r.brand)} of ${products.length} products · category matched: ${count((r) => r.rowType === "Product" && r.category)}`,
  "",
  "HOW TO REVIEW",
  "1. Start with \"Needs attention\": every Blocker and Check row, worst first.",
  "2. In \"Proposed products\", check each group marked Medium or Low: are these really colours/lengths/sizes of one product? Also check \"Category confidence\" Medium: the subcategory was guessed from a hair brand (e.g. Braids).",
  "3. Use the \"Review decision\" column (Approve, Change, Remove, Merge into another product, Split out of this group) and write corrections in \"Reviewer notes\".",
  "4. Blank brand or category means it could not be identified: fill it in rather than guess.",
  "",
  "SEVERITY",
  "Blocker: must be resolved before import (duplicate codes, prices below cost or zero, no category, non-product rows, identical items).",
  "Check: a person should confirm (uncertain grouping or category, missing brand, compliance wording, per-ml refills, pack types, new categories).",
  "Info: recorded for reference (spelling fixed, different VAT setting in the old POS, no old category).",
  "",
  "PROPOSED CODES",
  "Product code BRA-0001: three letters of the brand (GEN when unbranded) and a number. Variant SKU BRA-0001-01. These are proposals; the old POS SKU stays with each item so staff can still find it and old sales still match.",
  "",
  "OPEN DECISIONS FOR SPARKLE",
  "• VAT: settled. Shelf prices include VAT (2026-11-11).",
  "• Refill perfumes sold per ml: sell by bottle size, or by ml?",
  "• Wholesale prices: the export has one selling price only.",
  "• New categories proposed: Nails, Makeup, Personal care, Health & wellness.",
  "• Products named after designer brands, skin-lightening products and supplements: confirm they may be sold and how they are described.",
  "• Manufacturer barcodes: the old barcode is just the SKU number.",
];

const parentCols = [["Product code", 12], ["Proposed product name", 36], ["Brand", 16], ["Category", 18], ["Subcategory", 16], ["Category confidence", 12], ["Option type", 16], ["Variants", 8],
  ["Grouping confidence", 13], ["Why uncertain", 40], ["Variant options", 60], ["Price min (KES)", 10], ["Price max (KES)", 10], ["Old POS SKUs", 30], ["Export rows", 22], ["Review decision", 16], ["Reviewer notes", 30]]
  .map(([header, width]) => ({ header, width }));
const parentRows = parents.map((p) => [p.code, p.name, p.brand, p.category, p.subcategory, conf(p.categoryConfidence), p.optionType, p.members.length, conf(p.confidence === "Single product" ? "Single" : p.confidence),
  p.reasons.join("; "), { v: p.members.map((m) => m.variantLabel || "—").join(", "), s: STYLE.wrap }, money(p.minPrice), money(p.maxPrice),
  p.members.map((m) => m.oldSku).join(", "), p.members.map((m) => m.excelRow).join(", "), "", ""]);

const attention = rows.filter((r) => r.severity === "Blocker" || r.severity === "Check").sort((a, b) => RANK[b.severity] - RANK[a.severity] || a.excelRow - b.excelRow);
const nonProducts = rows.filter((r) => r.rowType === "Non-product");
const brandMap = new Map();
products.forEach((r) => { const b = r.brand || "(not identified)"; const e = brandMap.get(b) ?? { n: 0, spellings: new Set(), cats: new Set() }; e.n++; e.spellings.add(r.rawName.toUpperCase().split(/\s+/)[0]); e.cats.add(r.category || "?"); brandMap.set(b, e); });
const catMap = new Map();
products.forEach((r) => { const k = `${r.category || "(none)"}|${r.subcategory}`; const e = catMap.get(k) ?? { n: 0, high: 0, med: 0 }; e.n++; if (r.categoryConfidence === "High") e.high++; else e.med++; catMap.set(k, e); });

const sheets = [
  { name: "Read me", noHeader: true, columns: [{ header: "", width: 140 }], rows: readme.map((t, i) => [{ v: t, s: i === 0 || /^[A-Z ]+$/.test(t) && t ? STYLE.bold : STYLE.wrap }]) },
  { name: "Review (all rows)", columns: reviewCols, rows: rows.map(reviewRow), filter: true, validations },
  { name: "Proposed products", columns: parentCols, rows: parentRows, filter: true, validations: [{ column: 15, list: DECISIONS }] },
  { name: "Needs attention", columns: reviewCols, rows: attention.map(reviewRow), filter: true, validations },
  { name: "Non-product rows", columns: [["Export row", 9], ["Old POS SKU", 10], ["Original name (exact)", 36], ["Why", 50], ["Cost (KES)", 10], ["Selling price (KES)", 12], ["Locations", 24], ["Proposed handling", 40], ["Reviewer notes", 30]].map(([header, width]) => ({ header, width })),
    rows: nonProducts.map((r) => [r.excelRow, r.oldSku, r.rawName, r.nonProductReason, money(r.cost), money(r.sell), r.locations, /Delivery/.test(r.nonProductReason) ? "Do not migrate: Sparkle calculates delivery fees itself" : "Do not migrate as a product; confirm", ""]), filter: true },
  { name: "Brands", columns: [["Brand (proposed)", 22], ["Products", 9], ["How it appears in the export", 34], ["Categories", 40]].map(([header, width]) => ({ header, width })),
    rows: [...brandMap].sort((a, b) => b[1].n - a[1].n).map(([b, e]) => [b, e.n, [...e.spellings].join(", "), [...e.cats].join(", ")]), filter: true },
  { name: "Categories", columns: [["Category", 26], ["Subcategory", 18], ["Products", 9], ["Matched by keyword", 12], ["Guessed / none", 12]].map(([header, width]) => ({ header, width })),
    rows: [...catMap].sort((a, b) => b[1].n - a[1].n).map(([k, e]) => { const [c, s] = k.split("|"); return [c, s, e.n, e.high, e.med]; }), filter: true },
  { name: "Original export", columns: [{ header: "Export row", width: 9 }, ...header.map((h) => ({ header: h, width: 16 }))], rows: original.map((o) => [o.excelRow, ...o.cells]), filter: true },
];
writeFileSync(output, writeWorkbook(sheets));

// Self-check: every original row appears exactly once in the review sheet, with its exact name and SKU.
const seen = new Set(rows.map((r) => r.excelRow));
if (seen.size !== original.length || rows.some((r, i) => r.rawName !== String(original[i].cells[C.name]).trim() || r.oldSku !== String(original[i].cells[C.sku]).trim())) throw new Error("Row preservation check failed");
// Self-check: cost and selling price copied unchanged (totals match the original columns, and every value is a number).
const total = (i) => original.reduce((sum, o) => sum + Number(o.cells[i]), 0);
const sumOf = (f) => rows.reduce((sum, r) => sum + r[f], 0);
if (rows.some((r) => !Number.isFinite(r.sell) || !Number.isFinite(r.cost)) || Math.abs(total(C.sell) - sumOf("sell")) > 0.001 || Math.abs(total(C.costInc) - sumOf("cost")) > 0.001) throw new Error("Price preservation check failed");
console.log("totals", { sellingPrice: Math.round(sumOf("sell") * 100) / 100, cost: Math.round(sumOf("cost") * 100) / 100 });
console.log(JSON.stringify({
  rows: rows.length, products: products.length, nonProducts: nonProducts.length, parents: parents.length,
  withVariants: parents.filter((p) => p.members.length > 1).length, rowsInVariantGroups: parents.filter((p) => p.members.length > 1).reduce((s, p) => s + p.members.length, 0),
  groupConfidence: { High: parents.filter((p) => p.confidence === "High").length, Medium: parents.filter((p) => p.confidence === "Medium").length, Low: parents.filter((p) => p.confidence === "Low").length },
  severity: { Blocker: bySev("Blocker"), Check: bySev("Check"), Info: bySev("Info"), OK: bySev("OK") },
  brandIdentified: count((r) => r.rowType === "Product" && r.brand), categoryMatched: count((r) => r.rowType === "Product" && r.category),
  output,
}, null, 1));
