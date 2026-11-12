// Minimal .xlsx reader and writer for the migration scripts (fflate does the zip part).
// Reader: first worksheet → array of rows (arrays of strings). Writer: several sheets with a
// header row, frozen header, filters, column widths, a few fills and optional list validations.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&");
const colIndex = (ref) => { let n = 0; for (const c of ref.match(/^[A-Z]+/)[0]) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
const colName = (i) => { let s = ""; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

/** Rows of a worksheet (default the first), as strings ("" for empty cells). */
export function readFirstSheet(bytes, index = 0) {
  const files = unzipSync(bytes);
  const text = (p) => (files[p] ? strFromU8(files[p]) : "");
  const strings = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const rel = text("xl/_rels/workbook.xml.rels");
  const firstId = [...text("xl/workbook.xml").matchAll(/<sheet [^>]*r:id="([^"]+)"/g)][index][1];
  const target = rel.match(new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ?? rel.match(new RegExp(`Target="([^"]+)"[^>]*Id="${firstId}"`))[1];
  const sheet = text("xl/" + target.replace(/^\/?xl\//, ""));
  const rows = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = c[2].match(/t="(\w+)"/)?.[1];
      const inner = c[3] ?? "";
      let v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (type === "s") v = strings[+v];
      else if (type === "inlineStr") v = decode([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
      else if (v !== undefined) v = decode(v);
      row[colIndex(c[1])] = v ?? "";
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return rows;
}

// Styles: 0 normal, 1 header, 2 red fill, 3 amber fill, 4 green fill, 5 "0.0", 6 "#,##0", 7 wrap/top, 8 bold
export const STYLE = { normal: 0, header: 1, red: 2, amber: 3, green: 4, decimal: 5, money: 6, wrap: 7, bold: 8 };
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD0237A"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFCE1E1"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDF0D5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3F4EA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A cell is a string, a number, null, or { v, s } with a style from STYLE.
 * sheet = { name, columns: [{ header, width }], rows: Cell[][], filter?: true, validations?: [{ column, list }] }
 */
function sheetXml(sheet) {
  const headerRow = sheet.columns.map((c) => ({ v: c.header, s: STYLE.header }));
  const all = sheet.noHeader ? sheet.rows : [headerRow, ...sheet.rows];
  const rowsXml = all.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const { v, s } = cell !== null && typeof cell === "object" ? cell : { v: cell, s: 0 };
    if (v === null || v === undefined || v === "") return s ? `<c r="${colName(c)}${r + 1}" s="${s}"/>` : "";
    const ref = `${colName(c)}${r + 1}`;
    return typeof v === "number" && Number.isFinite(v)
      ? `<c r="${ref}" s="${s}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const last = `${colName(sheet.columns.length - 1)}${all.length}`;
  const cols = `<cols>${sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join("")}</cols>`;
  const view = sheet.noHeader ? `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  const filter = sheet.filter && all.length > 1 ? `<autoFilter ref="A1:${last}"/>` : "";
  const dv = (sheet.validations ?? []).filter(() => all.length > 1).map((d) => {
    const col = colName(d.column);
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${col}2:${col}${all.length}"><formula1>"${esc(d.list.join(","))}"</formula1></dataValidation>`;
  });
  const dvXml = dv.length ? `<dataValidations count="${dv.length}">${dv.join("")}</dataValidations>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${last}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rowsXml}</sheetData>${filter}${dvXml}</worksheet>`;
}

/** The workbook as .xlsx bytes. */
export function writeWorkbook(sheets) {
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>
${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
${sheets.some((s) => s.filter) ? `<definedNames>${sheets.map((s, i) => (s.filter && s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name.slice(0, 31))}'!$A$1:$${colName(s.columns.length - 1)}$${s.rows.length + 1}</definedName>` : "")).join("")}</definedNames>` : ""}</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES_XML,
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
}
