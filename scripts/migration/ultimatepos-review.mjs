// Builds the human-review workbook for migrating the UltimatePOS product export into Sparkle.
//
//   node scripts/migration/ultimatepos-review.mjs <export.xlsx> <review.xlsx>
//
// It changes nothing anywhere: it reads the export and writes a workbook that keeps every original
// row and shows the proposed product, brand, category, variant options, codes and all warnings.
// Prices are copied as they are (the VAT interpretation is unresolved), stock is not touched
// (the export has no quantities) and images are left out. Uncertain groupings are flagged, not
// guessed. The data files stay in products/ (git-ignored: they hold real cost prices).
import { readFileSync, writeFileSync } from "node:fs";
import { STYLE, readFirstSheet, writeWorkbook } from "./xlsx.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) { console.error("usage: node scripts/migration/ultimatepos-review.mjs <export.xlsx> <review.xlsx>"); process.exit(1); }

// ---------------------------------------------------------------------------------------------
// Rules. Keep them readable: Sparkle staff and the next agent need to check every decision.
// ---------------------------------------------------------------------------------------------

/** Spelling fixes applied to whole words (each fix is listed on the row). */
const SPELLING = {
  ANGLES: "ANGELS", ANGELSJIBAMBE: "ANGELS JIBAMBE", TUMERIC: "TURMERIC", BRAZILLIAN: "BRAZILIAN", PERUME: "PERFUME",
  FORMULAR: "FORMULA", TORQUISE: "TURQUOISE", TORQUOISE: "TURQUOISE", TORQUIOSE: "TURQUOISE", TORQOISE: "TURQUOISE",
  CLENSER: "CLEANSER", S0AP: "SOAP", EARINGS: "EARRINGS", EARING: "EARRING", DYER: "DRYER", CARROTTE: "CAROTTE", SCRUPPER: "SCRUBBER", DRAPPERS: "DRAPERS",
  ANGES: "ANGELS", FASHIO: "FASHION", LUAH: "LUSH", DSARLING: "DARLING", OLIVA: "OLIVIA", DAYNE: "DAYNEE", GEUSS: "GUESS", BELLERINA: "BALLERINA",
  LIPSTIC: "LIPSTICK", TURQOUISE: "TURQUOISE", OLIPIA: "OLIVIA", GODESS: "GODDESS", MOUSE: "MOUSSE", METTALIC: "METALLIC", TORQUOSE: "TURQUOISE", TORQ: "TURQUOISE",
};

/** Likely prescription-only medicines (steroid creams) that turn up in beauty shops. */
const PRESCRIPTION = /\b(EPIDERM|LEMONVATE|DIPROSON|MOVATE|BETNOVATE|DERMOVATE|CLOBETASOL|BETAMETHASONE|HYDROQUINONE)\b/;

/** Brands, matched at the start of the cleaned name (longest first). Only brands checked by hand. */
const BRANDS = {
  "ANGELS": "Angels", "DARLING": "Darling", "LUSH": "Lush", "OLIVIA": "Olivia", "PRIMA": "Prima", "FASHION IDOL": "Fashion Idol",
  "SISTA": "Sista", "SISTER": "Sister", "JENNY": "Jenny", "LABO": "Labo", "LA CHIC": "La Chic",
  "BAMSI": "Bamsi", "RONIKI": "Roniki", "NICE & LOVELY": "Nice & Lovely", "ADORA": "Adora", "MOVIT": "Movit", "ZOE": "Zoe",
  "DR. DAVEY": "Dr. Davey", "DR. RASHELL": "Dr. Rashel", "DR. RASHEL": "Dr. Rashel", "BLUE SKY": "Blue Sky", "SOFT N FREE": "Soft N Free", "GOLD TOUCH": "Gold Touch", "HUDA": "Huda", "AMARA": "Amara", "DAYNEE": "Daynee", "VALON": "Valon", "HOBBY": "Hobby", "NIVEA": "Nivea",
  "VENUS": "Venus", "SEDOSO": "Sedoso", "RADIANT": "Radiant", "VEET": "Veet", "AL-REHAB": "Al-Rehab", "BEULA": "Beula",
  "BLACK ESSENTIAL": "Black Essential", "BLACK OPAL": "Black Opal", "LURON": "Luron", "DEAR BODY": "Dear Body", "ANGELIQUE": "Angelique",
  "VERSMAN": "Versman", "CLERE": "Clere", "FLAVIA": "Flavia", "MEGA GROWTH": "Mega Growth", "BALLET": "Ballet", "BETTAR": "Bettar",
  "GARNIER": "Garnier", "TCB": "TCB", "MIADI": "Miadi", "SOFTCARE": "Softcare", "LATEST": "Latest", "RASASI": "Rasasi",
  "BABYLOVE": "Babylove", "KISS BEAUTY": "Kiss Beauty", "OCARLY": "Ocarly", "SKALA": "Skala", "AICHUN": "Aichun", "REXONA": "Rexona",
  "VASELINE": "Vaseline", "DARK & LOVELY": "Dark & Lovely", "DARK & BEAUTIFUL": "Dark & Beautiful", "ESTELIN": "Estelin", "KADRI": "Kadri",
  "PARADISE": "Paradise", "PAW PAW": "Paw Paw", "UNIFUL": "Uniful", "AMERICAN DREAM": "American Dream", "B.E": "B.E", "BLUE MAGIC": "Blue Magic",
  "CAROLIGHT": "Carolight", "FRANCOISE PARIS": "Francoise Paris", "FRUIT OF WOKALI": "Fruit of Wokali", "WOKALI": "Wokali", "IDEAL": "Ideal",
  "SAYONA": "Sayona", "SHEBA": "Sheba", "SUBARU": "Subaru", "BODYLUXE": "Bodyluxe", "CUTE & PRETTY": "Cute & Pretty", "DISAAR": "Disaar",
  "ROBIN": "Robin", "CREAM OF NATURE": "Cream of Nature", "KOJIE.SAN": "Kojie San", "KOJIE SAN": "Kojie San", "NOOR": "Noor", "ROBERTS": "Roberts",
  "SIRI": "Siri", "STYLIN DREDZ": "Stylin' Dredz", "VELVEX": "Velvex", "MOIKA": "Moika", "PLAYBERRY": "Playberry", "ARIMIS": "Arimis",
  "ASANTE": "Asante", "BB CLAIRE": "BB Claire", "BOLD & BEAUTIFUL": "Bold & Beautiful", "CANTU": "Cantu", "COCOPULP": "Cocopulp", "DAVIS": "Davis",
  "FAIZA": "Faiza", "SLEEK": "Sleek", "ALISON": "Alison", "ASHANTI": "Ashanti", "ASPATEK": "Aspatek", "BEAUTION": "Beaution", "CERIOTTI": "Ceriotti",
  "CAROTONE": "Carotone", "CHADNI": "Chadni", "CRAZY COLORS": "Crazy Colors", "DEXE": "Dexe", "DIPROSON": "Diproson", "DOVE": "Dove", "EDEN": "Eden",
  "EPIGLOW": "Epiglow", "FOGG": "Fogg", "GATSBY": "Gatsby", "GUANJING": "Guanjing", "HALF CAST": "Half Cast", "KRISTINA": "Kristina",
  "LANSHADE": "Lanshade", "LIGHT UP": "Light Up", "LUODAIS": "Luodais", "MAKARI": "Makari", "MOLATO": "Molato", "RDL": "RDL", "SULTANA": "Sultana",
  "UJOOBA": "Ujooba", "YOUNG AND ONLY": "Young and Only", "WINSTOWN": "Winstown", "KORMESIC": "Kormesic", "FLOGIRL": "Flogirl",
  "SUNNY GIRL": "Sunny Girl", "SHANILIA": "Shanilia", "MAGIC": "Magic", "MISS BEAUTY": "Miss Beauty", "AER": "Aer", "SOFT 7": "Soft 7",
};
/** Brands whose products are hair styles (braids, crochet, weaves, wigs) unless a keyword says otherwise. */
const HAIR_BRANDS = new Set(["Angels", "Darling", "Lush", "Olivia", "Prima", "Fashion Idol", "Sista", "Sister", "Jenny", "Labo", "La Chic"]);

/** Category rules, first match wins. [regex, category, subcategory]. "(new)" = not yet in the Sparkle category list. */
const CATEGORY_RULES = [
  [/\b(PILLS|\d+MG|ZINC|FERTILITY|PCOS|POSTPARTUM|SLIM COFFEE|TEA(?! TREE)|GUMMIES|TABLETS?|TABS|CAPSULES?|TEA BAGS|SLIM TEA|TUMMY TEA|SLIMMING|FAT BURNER|INJECTION|SUPPLEMENT)\b/, "Health & wellness (new)", ""],
  [/\b(DEO|DEO ROLL|HAIR REMOVAL|BATH BELT|DIAPERS?|SANITARY|PADS|PANTIE LINERS|LINERS|WIPES|TISSUES?|COTTON WOOL|ANTISEPTIC|SURGICAL SPIRIT|ROLL ONS?|DEODORANT|AFTER ?SHAVE|BUMP PATROL|RAZORS?)\b/, "Personal care (new)", ""],
  [/\b(PERFUMES?|EDP|EDT|BODY MIST|BODY SPLASH|SPLASH|COLOGNE|OUD|ATTAR)\b/, "Perfumes", ""],
  [/\b(MANICURE|(?<!SCAR )(?<!MARK )REMOVER|NAILS?|CUTEX|POLISH|BASE COAT|TOP COAT|BUILDER GEL|GEL COLORS|ACETONE|CUTICLE|UV MACHINE|GEL MACHINE|HARD TIPS|TIPS)\b/, "Cosmetics", "Nails (new)"],
  [/\bWIGS? SERUM\b/, "Hair & Wigs", "Hair care"],
  [/\bWIGS?\b/, "Hair & Wigs", "Wigs"],
  [/\b(H\/FOOD|WASH AND GO|DREADS? SPRAY|HAIR POLISHER|LOCS SPRAY|BONDING GLUE|WIG GLUE|HAIR FERTILI[SZ]ER|SPECIAL BASE|ACTIVE VITAMIN|JP|ANTI\/D|SHAMPOO|CONDITIONER|CONDITION|RELAXER|HAIR ?FOOD|TREATMENT|LEAVE.?IN|ACTIVATOR|MOUSSE|SHEEN|GROWTH|HAIR OIL|HAIR DYE|DYE|PEROXIDE|MOULDING WAX|WAX|STYLING GEL|BRAIDING GEL|EDGE|CURLING CREAM|CASTOR|ANTIDANDRUFF|ANTI ?D|ANTID|BRAID SPRAY|DREAD SPRAY|HAIR LOTION|HAIR SERUM|HAIR BOOSTER|SETTING LOTION|BLOW OUT|TEXTURI[SZ]ER|HAIR SPRAY|HAIRFOOD|SP)\b/, "Hair & Wigs", "Hair care"],
  [/\b(BEAUTY BLENDER|BLENDER|LIP ?STICK|LIP ?GLOSS|LIP OIL|LIP BALM|LIP|MASCARA|EYELASH(ES)?|LASH(ES)?|BROW|EYE PENCIL|EYELINER|PENCIL|FOUNDATIONS?|CONCEALER|PRIMER|POWDER|BLUSH|BRONZER|HIGHLIGHTER|PALETTE|EYESHADOW|MAKE ?UP|SETTING SPRAY|FIXER)\b/, "Cosmetics", "Makeup (new)"],
  [/\b(HAND WASH|OINTMENT|LTN|BLEACH|HYDRATION|NOURISHING|MICELLAR|MOISTURI[SZ]ER|SCAR REMOVER|DARK SPOT|SPOT CORRECTOR|SKIN|FAIR|TUBE|LOTIONS|SHOWER GEL|LOTION|CREAM|JELLY|SERUM|SCRUB|SOAP|SHOWER|BODY WASH|FACE WASH|CLEANSER|TONER|GLYCERINE|SUNSCREEN|SUN SCREEN|SPF|BODY OIL|BUTTER|BALM|MILK|MASK|PEELING|ROSE WATER|PETROLEUM|SPOT FIX|GEL|OIL)\b/, "Skincare", ""],
  [/\b(NOSE RINGS|RINGS|BEADS|EARRINGS?|KEY HOLDERS|FAN|FOOT SPA|FOOT STONE|SALON SINK|MANNEQUIN|DUMMY|NECK ROLLS|UV LIGHT|COMBS?|BRUSH(ES)?|MIRROR|BONNETS?|CAPS?|DURAG|CLIPS?|PINS|BANDS?|RUBBER|NET|HEADBAND|SCRUNCH\w*|BOWLS?|MACHINE|DRYER|BLOWDRY|BLOW DRY|IRON|STRAIGHTENER|CLIPPER|SCISSORS|NEEDLES?|THREAD|ROLLERS|NOZZLE|SPONGE|TOWEL|DRAPERS|GLOVES|SCRUBBER|GRATER|EARRINGS|CHAINS|BAGS?|BOTTLES?|SYRINGE|WOOL|SPRAY BOTTLE)\b/, "Accessories", ""],
  [/\bKIDS\b/, "Hair & Wigs", "Kids Braids", "hairOnly"],
  [/\b(PONY ?TAIL|BUNS?|CLOSURE|FRONTAL|DONUT)\b/, "Hair & Wigs", "Hair Pieces", "hairOnly"],
  [/\b(WEAVE|REMI|REMY|EXTENSIONS?|BUNDLE)\b/, "Hair & Wigs", "Extensions"],
  [/\b(BRAIDS?|BR|TWIST|LOCS?|CRO|CROCHET|KINKY|MARLEY|DREADS?|BULK|CURLS?|CURLZ|WAVE|FULANI|JUMBO|AFRO)\b/, "Hair & Wigs", "Braids", "hairOnly"],
];

const COLOUR_WORDS = new Set(("BLACK BROWN BLONDE BLOND BURGUNDY BUG BURG BLUE RED GREEN PINK GREY GRAY PURPLE WHITE GOLD GOLDEN ORANGE YELLOW MAROON ROYAL MOSS " +
  "TURQUOISE SILVER COPPER AUBURN HONEY OMBRE MIX MIXED PEACH LILAC WINE PLUM CARAMEL GINGER ASH BEIGE NUDE TEAL NAVY MULTI COLORED COLOURED RAINBOW NATURAL DARK LIGHT LATTE CHOCOLATE MOCHA CINNAMON CHERRY GRY").split(" "));
const HAIR_CODE = /^(?:[TFP]{1,2})?\d{1,4}[A-Z]?$|^99J$/;
/** Inside a slashed colour (1/350/27, M1/900, D/PURPLE, 1GRY) parts may carry a letter prefix or suffix. */
const HAIR_CODE_PART = /^[A-Z]{0,2}\d{1,4}[A-Z]{0,3}$|^[A-Z]$/;
const LENGTHS = ["SUPER LONG", "XTRA LONG", "EXTRA LONG", "LONG", "SHORT", "MEDIUM"];
const SIZE_RE = /\b(\d+(?:\.\d+)?)\s?(MLS?|M\.L|GMS?|GRAMS?|G|KGS?|LTRS?|LITRES?|LTR|L)\b/;
const UNIT = { ML: "ml", MLS: "ml", "M.L": "ml", G: "g", GM: "g", GMS: "g", GRAM: "g", GRAMS: "g", KG: "kg", KGS: "kg", L: "L", LTR: "L", LTRS: "L", LITRE: "L", LITRES: "L" };
const DESIGNER = /\b(GUCCI|HUGO|BOSS|CHANEL|CHANNEL|DIOR|ARMANI|VERSACE|YSL|OPIUM|INVICTUS|GOOD GIRL|BACARRAT|BACCARAT|AZZARO|BECKHAM|LACOSTE|PACO|1 MILLION|ONE MILLION|TOM FORD|CREED|PRADA|BURBERRY|CALVIN|DOLCE|D&G|VICTORIA SECRET|VICTORIA'S|BLACK XS|SAUVAGE|LANCOME|GIVENCHY|KIM KARDASHIAN|DUNHILL|POLO|COOL WATERS|DAVIDOFF|MONTBLANC|CAROLINA HERRERA|212|JADORE|J'ADORE|ALLURE|FAHRENHEIT|ESCADA|NINA RICCI|BOMBSHELL|LADY MILLION|SCANDAL|LIBRE|IDOLE)\b/;
const LIGHTENING = /\b(WHITENING|WHITE|LIGHTENING|LIGHTENER|BLEACH\w*|FAIR|GLUTA\w*|CAROTTE|CAROTONE|CARROT|MOLATO|HALF CAST|BRIGHTENING|SPOTLESS|EVEN TONE)\b/;
const NON_PRODUCT = [
  [/^TEST$/, "Test item"], [/^CAR$/, "Unclear item (\"CAR\")"], [/^STONE$/, "Unclear item (\"STONE\")"],
  [/\bDISPLAY (HOOKS|RAIL)/, "Shop fixture"], [/^PERFUME DISPLAY BOTTLES$/, "Shop fixture"], [/^DELIVERY SERVICE$/, "Delivery service (Sparkle charges delivery separately)"],
];
const ACRONYMS = new Set(["TCB", "UV", "BB", "B.E", "SPF", "EDP", "EDT", "CK", "D&G", "YSL", "XL", "XXL", "II", "III", "RDL", "AB", "SY", "AHA", "BHA", "PH", "VIP", "USA", "UK", "3D", "4D", "5D", "6D", "XS", "C/KICK"]);

// ---------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------
const sheetRows = readFirstSheet(readFileSync(input));
const header = sheetRows[0].map((h) => h.trim());
// Exact header first: "SELLING PRICE" must not match "Selling Price Tax Type …".
const col = (prefix) => { const exact = header.findIndex((h) => h.toUpperCase() === prefix); const i = exact >= 0 ? exact : header.findIndex((h) => h.toUpperCase().startsWith(prefix)); if (i < 0) throw new Error(`Column not found: ${prefix}`); return i; };
const C = { name: col("NAME"), unit: col("UNIT"), category: col("CATEGORY"), sku: col("SKU"), costInc: col("PURCHASE PRICE (INCLUDING"), costEx: col("PURCHASE PRICE (EXCLUDING"),
  margin: col("PROFIT MARGIN"), sell: col("SELLING PRICE"), tax: col("SELLING PRICE TAX"), locations: col("PRODUCT LOCATIONS") };
const original = sheetRows.slice(1).map((r, i) => ({ excelRow: i + 2, cells: header.map((_, c) => r[c] ?? "") })).filter((r) => r.cells.some((v) => v !== ""));

// ---------------------------------------------------------------------------------------------
// Clean each row
// ---------------------------------------------------------------------------------------------
const titleWord = (w) => {
  if (!w) return w;
  if (ACRONYMS.has(w) || /\d/.test(w) || /^[A-Z]\.([A-Z]\.?)+$/.test(w)) return w;
  return w.split(/([-/&'.])/).map((p) => (/^[A-Z]+$/.test(p) ? p[0] + p.slice(1).toLowerCase() : p)).join("");
};
const title = (s) => s.split(" ").map(titleWord).join(" ").replace(/\b(And|Of|With|For|In|The)\b/g, (m, _w, i) => (i === 0 ? m : m.toLowerCase()));

function clean(raw) {
  const fixes = [];
  let n = raw.toUpperCase().replace(/\s+/g, " ").trim()
    .replace(/\s*\/\s*/g, "/").replace(/\s*\|\s*/g, "|").replace(/\{\s*/g, " {").replace(/\s*\}/g, "}").replace(/\s+/g, " ").trim();
  n = n.split(" ").map((w) => w.split(/([/|])/).map((part) => {
    const bare = part.replace(/[^A-Z0-9.]/g, "");
    if (SPELLING[bare]) { fixes.push(`${bare} → ${SPELLING[bare]}`); return part.replace(bare, SPELLING[bare]); }
    return part;
  }).join("")).join(" ");
  n = n.replace(/\b(\d+)O(\d*)(MLS?|GMS?)\b/, (m, a, b, u) => { fixes.push(`${m} → ${a}0${b}${u}`); return `${a}0${b}${u}`; });
  if (/^ANGEL\s/.test(n)) { n = n.replace(/^ANGEL\s/, "ANGELS "); fixes.push("ANGEL → ANGELS"); }
  return { n: n.replace(/\s+/g, " ").trim(), fixes };
}

function brandOf(n) {
  for (const key of Object.keys(BRANDS).sort((a, b) => b.length - a.length)) {
    if (n === key || n.startsWith(key + " ")) return { brand: BRANDS[key], rest: n.slice(key.length).trim() };
  }
  return { brand: "", rest: n };
}

function categoryOf(n, brand) {
  const hairBrand = HAIR_BRANDS.has(brand);
  for (const [re, cat, sub, hairOnly] of CATEGORY_RULES) {
    if (!re.test(n)) continue;
    if (hairOnly && !hairBrand && !/\b(BRAIDS?|TWIST|LOCS|CROCHET|KINKY|MARLEY|DREAD|FULANI|PONY|CLOSURE|WEAVE|EXTENSION|BUNS?)\b/.test(n)) continue;
    // A hair brand's "curl"/"wave" lines are hair, even if a later accessory word appears.
    return { category: cat, subcategory: sub, confidence: "High", how: `keyword ${String(re).slice(3, 40)}…` };
  }
  if (hairBrand) return { category: "Hair & Wigs", subcategory: "Braids", confidence: "Medium", how: "hair brand, no style keyword" };
  return { category: "", subcategory: "", confidence: "Low", how: "no rule matched" };
}

/** Hair styles: trailing colour codes/words and a length word. */
function hairAttributes(rest) {
  const t = rest.split(" ");
  let i = t.length;
  const isColour = (tok) => (/[/|]/.test(tok)
    ? tok.split(/[/|]/).filter(Boolean).every((p) => HAIR_CODE_PART.test(p) || COLOUR_WORDS.has(p))
    : HAIR_CODE.test(tok) || COLOUR_WORDS.has(tok));
  while (i > 1 && isColour(t[i - 1])) i--;
  let colour = t.slice(i).join(" ");
  let base = t.slice(0, i);
  let length = "";
  const inch = base.length > 1 && base.at(-1).match(/^(\d{1,2})("|INCH(ES)?)$/);
  if (inch) { length = `${inch[1]}"`; base = base.slice(0, -1); }
  if (!length) {
    const joined = base.join(" ");
    const hit = LENGTHS.find((l) => joined.endsWith(" " + l) && joined !== l);
    if (hit) { length = title(hit); base = joined.slice(0, -hit.length).trim().split(" "); }
  }
  if (base.length && /^(BR)$/.test(base.at(-1)) && !colour) colour = "";
  return { base: base.join(" "), colour: colour.replace(/\|/g, " | "), length };
}

/** Everything else: size, big/small, pack type, trailing shade/colour, {bracketed line}. */
function otherAttributes(rest, category) {
  let s = rest;
  let size = "", pack = "", colour = "", shade = "", weak = false;
  const m = s.match(SIZE_RE);
  if (m) { size = `${m[1]} ${UNIT[m[2]] ?? m[2].toLowerCase()}`; s = s.replace(m[0], " "); }
  const bs = s.match(/\b(B\/S|S\/S)\b/);
  if (bs && !size) { size = bs[1] === "B/S" ? "Big" : "Small"; s = s.replace(bs[0], " "); weak = true; }
  const p = s.match(/\b(WHOLESALE( PER DOZE?N?| IN \w+)?|RETAIL|PER DOZE?N?|DOZEN|\d+\s?PCS|PKTS?)\b/);
  if (p) { pack = title(p[1].replace(/DOZE$/, "DOZEN")); s = s.replace(p[0], " "); }
  const br = s.match(/\{([^}]+)\}/);
  if (br) { colour = title(br[1]); s = s.replace(br[0], " "); weak = true; }
  s = s.replace(/\s+/g, " ").trim();
  const t = s.split(" ");
  if (!colour && t.length > 1) {
    if (category === "Cosmetics" && (/^(NO\.?\d+|[A-Z]{0,3}\d{1,4}[A-Z]?)$/.test(t.at(-1)))) {
      const take = t.length > 2 && /^[A-Z]{1,3}$/.test(t.at(-2)) && !/^(GEL|LIP|TOP|NO)$/.test(t.at(-2)) ? 2 : 1;
      shade = t.slice(-take).join(" "); t.splice(-take); weak = true;
    } else if (/^NO\.?\d+$/.test(t.at(-1))) { shade = t.at(-1).replace(/^NO\.?/, "No. "); t.pop(); weak = true; }
    else {
      let i = t.length;
      while (i > 1 && COLOUR_WORDS.has(t[i - 1]) && !/^(NATURAL|DARK|LIGHT|WHITE)$/.test(t[i - 1])) i--;
      if (i < t.length && category !== "Skincare") { colour = title(t.slice(i).join(" ")); t.splice(i); weak = true; }
    }
  }
  if (!size && t.length > 1 && /^(BIG|SMALL|MEDIUM|LARGE|L|M|S)$/.test(t.at(-1)) && /^(Accessories|Personal care \(new\))$/.test(category)) {
    size = title(t.pop()); weak = true;
    if (t.length > 1 && /^(BIG|SMALL|MEDIUM|LARGE)$/.test(t.at(-1))) { size = title(t.pop()) + (size.length === 1 ? ` (${size})` : ""); }
  }
  return { base: t.join(" "), size, pack, colour, shade, weak };
}

const rows = original.map((o) => {
  const g = (i) => String(o.cells[i] ?? "").trim();
  const rawName = g(C.name);
  const { n, fixes } = clean(rawName);
  const nonProduct = NON_PRODUCT.find(([re]) => re.test(n));
  const { brand, rest } = brandOf(n);
  const cat = nonProduct ? { category: "", subcategory: "", confidence: "", how: "" } : categoryOf(n, brand);
  const isHairStyle = cat.category === "Hair & Wigs" && cat.subcategory !== "Hair care";
  const attrs = isHairStyle ? { ...hairAttributes(rest), size: "", pack: "", shade: "", weak: false } : otherAttributes(rest, cat.category);
  const cost = Number(g(C.costInc)), sell = Number(g(C.sell)), margin = Number(g(C.margin));
  return {
    excelRow: o.excelRow, cells: o.cells, rawName, clean: n, fixes, brand, category: cat.category, subcategory: cat.subcategory, categoryConfidence: cat.confidence,
    brandConfidence: brand ? (fixes.some((f) => f.startsWith("ANGEL →")) ? "Medium" : "High") : "Not identified",
    base: attrs.base || rest || n, colour: attrs.colour ?? "", length: attrs.length ?? "", size: attrs.size ?? "", pack: attrs.pack ?? "", shade: attrs.shade ?? "", weakParse: attrs.weak,
    oldSku: g(C.sku), unit: g(C.unit), cost, sell, statedMargin: margin, markup: cost > 0 ? ((sell - cost) / cost) * 100 : null,
    tax: g(C.tax), oldCategory: g(C.category), locations: g(C.locations), costEx: Number(g(C.costEx)),
    rowType: nonProduct ? "Non-product" : "Product", nonProductReason: nonProduct?.[1] ?? "",
    warnings: [],
  };
});

// ---------------------------------------------------------------------------------------------
// Group into parent products. Never across brands or categories; uncertain groups are flagged.
// ---------------------------------------------------------------------------------------------
const products = rows.filter((r) => r.rowType === "Product");
const groups = new Map();
for (const r of products) {
  const key = [r.brand || "—", r.category, r.subcategory, r.base].join("|");
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const parents = [...groups.values()].sort((a, b) =>
  (a[0].category || "~").localeCompare(b[0].category || "~") || (a[0].subcategory || "").localeCompare(b[0].subcategory || "") ||
  (a[0].brand || "~").localeCompare(b[0].brand || "~") || a[0].base.localeCompare(b[0].base));

const attrKey = (r) => [r.colour, r.length, r.size, r.shade, r.pack].join("|");
parents.forEach((members, i) => {
  const id = i + 1;
  const first = members[0];
  const brandCode = (first.brand || "GEN").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const code = `${brandCode}-${String(id).padStart(4, "0")}`;
  const varies = (f) => new Set(members.map((m) => m[f])).size > 1 || (members.length > 1 && members.every((m) => m[f]) && false);
  const dims = ["colour", "length", "size", "shade", "pack"].filter((f) => members.some((m) => m[f]) && (members.length === 1 || varies(f)));
  const optionType = members.length === 1 ? "Single" : dims.length ? dims.map((d) => ({ colour: "Colour", length: "Length", size: "Size", shade: "Shade", pack: "Pack" })[d]).join(" + ") : "None (identical)";
  const keys = members.map(attrKey);
  const dupKeys = new Set(keys.filter((k, j) => keys.indexOf(k) !== j));
  const someBare = members.length > 1 && members.some((m) => !attrKey(m).replace(/\|/g, ""));
  const weak = members.some((m) => m.weakParse);
  let confidence = "Single product";
  const reasons = [];
  if (members.length > 1) {
    confidence = "High";
    if (!first.brand) { confidence = "Medium"; reasons.push("no brand identified"); }
    if (weak) { confidence = "Medium"; reasons.push("options read from size words, brackets or trailing codes"); }
    if (someBare) { confidence = "Medium"; reasons.push("one item has no colour/length/size: is it the same product?"); }
    if (dims.length > 2) { confidence = "Medium"; reasons.push("more than two option types"); }
    if (dupKeys.size) { confidence = "Low"; reasons.push("two items have identical options"); }
  }
  const parentName = [first.brand, title(first.base)].filter(Boolean).join(" ").trim() || title(first.clean);
  const prices = members.map((m) => m.sell);
  members.sort((a, b) => attrKey(a).localeCompare(attrKey(b), undefined, { numeric: true }) || a.excelRow - b.excelRow);
  members.forEach((m, j) => {
    Object.assign(m, { parentId: id, parentCode: code, parentName, groupSize: members.length, groupConfidence: confidence, groupReasons: reasons, optionType,
      variantSku: `${code}-${String(j + 1).padStart(2, "0")}`,
      variantLabel: [m.colour, m.shade, m.length, m.size, m.pack].filter(Boolean).join(" · ") || (members.length > 1 ? "(no option)" : "") });
    if (dupKeys.has(attrKey(m))) m.warnings.push(["Blocker", "Same name and options as another row in this group: duplicate?"]);
  });
  const categoryConfidence = members.some((m) => m.categoryConfidence === "Low") ? "Low" : members.some((m) => m.categoryConfidence === "Medium") ? "Medium" : "High";
  parents[i] = { id, code, name: parentName, brand: first.brand, category: first.category, subcategory: first.subcategory, categoryConfidence, optionType, confidence, reasons,
    members, minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
});

// ---------------------------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------------------------
const skuCount = new Map(); rows.forEach((r) => skuCount.set(r.oldSku, [...(skuCount.get(r.oldSku) ?? []), r]));
const nameCount = new Map(); rows.forEach((r) => nameCount.set(r.clean, [...(nameCount.get(r.clean) ?? []), r]));
for (const r of rows) {
  const w = (sev, text) => r.warnings.push([sev, text]);
  if (r.rowType === "Non-product") w("Blocker", `Not a stock product: ${r.nonProductReason}. Proposed: do not migrate as a product.`);
  const sameSku = skuCount.get(r.oldSku).filter((x) => x !== r);
  if (sameSku.length) w("Blocker", `Old SKU ${r.oldSku} is also used by export row ${sameSku.map((x) => x.excelRow).join(", ")} (${sameSku.map((x) => x.rawName).join("; ")})`);
  const sameName = nameCount.get(r.clean).filter((x) => x !== r);
  if (sameName.length && !r.warnings.some(([, t]) => t.startsWith("Same name and options"))) w("Blocker", `Same name as export row ${sameName.map((x) => x.excelRow).join(", ")}: duplicate?`);
  if (r.rowType !== "Product") continue;
  if (r.cost === 0) w("Blocker", "Cost price is 0");
  if (r.sell <= 1) w("Blocker", `Selling price is KES ${r.sell}`);
  else if (r.cost > 0 && r.sell < r.cost) w("Blocker", `Sells below cost (cost ${r.cost}, price ${r.sell})`);
  else if (r.cost > 0 && r.sell === r.cost) w("Check", "Selling price equals cost (no margin)");
  if (r.markup !== null && r.markup > 200) w("Check", `Very high markup (${Math.round(r.markup)}%): check cost and price`);
  if (!r.category) w("Blocker", "No category matched: choose one");
  else if (r.categoryConfidence === "Medium") w("Info", "Subcategory guessed from the hair brand (no style word in the name): confirm per product");
  if (/\(new\)/.test(r.category + r.subcategory)) w("Check", `Category "${[r.category, r.subcategory].filter(Boolean).join(" › ")}" does not exist in Sparkle yet`);
  if (!r.brand) w("Check", "Brand not identified: fill in or leave unbranded");
  if (r.groupConfidence === "Medium" || r.groupConfidence === "Low") w("Check", `Grouping uncertain: ${r.groupReasons.join("; ")}`);
  if (!r.locations) w("Check", "No location in the old POS");
  if (r.unit.toUpperCase() === "ML") w("Check", "Sold per ml in the old POS: decide how refills are sold");
  if (r.category === "Perfumes" && DESIGNER.test(r.clean) && !["Rasasi", "Al-Rehab"].includes(r.brand)) w("Check", "Named after a designer brand: confirm wording (e.g. \"inspired by\") before selling online");
  if (/Health & wellness/.test(r.category)) w(/INJECTION/.test(r.clean) ? "Blocker" : "Check", /INJECTION/.test(r.clean) ? "Injectable product: confirm it may be sold at all" : "Supplement/medicine claim: confirm it may be sold online");
  if (PRESCRIPTION.test(r.clean)) w("Blocker", "Likely prescription-only medicine (steroid cream): confirm it may be sold, and never online without a pharmacist");
  if (LIGHTENING.test(r.clean) && ["Skincare", "Cosmetics"].includes(r.category)) w("Check", "Skin-lightening wording: confirm the product is approved (KEBS / Pharmacy and Poisons Board) before selling online");
  if (/WHOLESALE|RETAIL|DOZEN/.test(r.clean)) w("Check", "Pack type in the name (wholesale/retail/dozen): should this be a pack option or wholesale price instead?");
  if (/\bOLD PACK\b/.test(r.clean)) w("Check", "\"Old pack\": still sold?");
  if (r.rawName.includes("|")) w("Check", "Name lists two colours (|): confirm what is actually sold");
  if (r.tax === "exclusive") w("Info", "Old POS VAT setting is \"exclusive\" (most rows are \"inclusive\"); from a separate import batch");
  if (!r.oldCategory) w("Info", "No category in the old POS");
  if (r.fixes.length) w("Info", `Spelling fixed: ${r.fixes.join(", ")}`);
}
const RANK = { Blocker: 3, Check: 2, Info: 1, OK: 0 };
for (const r of rows) {
  r.severity = r.warnings.reduce((s, [sev]) => (RANK[sev] > RANK[s] ? sev : s), "OK");
  r.warningText = r.warnings.sort((a, b) => RANK[b[0]] - RANK[a[0]]).map(([s, t]) => `${s}: ${t}`).join("\n");
}

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
  ["Old VAT setting (unresolved)", 13], ["Locations (old POS)", 22], ["Spelling fixes", 22], ["Highest severity", 11], ["Warnings", 60], ["Review decision", 16], ["Reviewer notes", 30],
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
  "• Prices are copied exactly. The VAT interpretation is unresolved: the old POS marks most prices \"inclusive\" while Sparkle adds VAT on top. Nicholas confirms how Sparkle prices today before any price is converted.",
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
  "• VAT: are today's shelf prices VAT-inclusive? (Decides whether prices are converted.)",
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
