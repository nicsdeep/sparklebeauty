import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META } from "@/lib/format";
import type { InvoiceBundle } from "@/lib/invoice-data";
import { ETIMS_META } from "@/lib/invoices";
import { TAX_TYPES, type TaxType } from "@/lib/tax";

// A4 PDF of a tax invoice or credit note, laid out like components/invoice-document.tsx.
// Fonts and logo are the site's own files (public/fonts, public/brand), read from disk; next.config.ts
// includes them in the PDF routes' serverless bundle.

const C = { brand: "#d0237a", brandDark: "#b01b66", brandSoft: "#fdf0f6", blue: "#0aa8f2", ink: "#1f1a1d", muted: "#645c61", line: "#e9e4e7", surface: "#f7f5f6" };

const asset = (...p: string[]) => path.join(process.cwd(), "public", ...p);
// Passed as data: a Windows path would be mistaken for a URL.
let logo: Buffer | null = null;
const LOGO = () => (logo ??= readFileSync(asset("brand", "sparkle-logo-invoice.png")));

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Jakarta",
    fonts: [400, 600, 700, 800].map((w) => ({ src: asset("fonts", `plus-jakarta-sans-${w}.woff`), fontWeight: w })),
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const s = StyleSheet.create({
  page: { fontFamily: "Jakarta", fontSize: 9, color: C.ink, paddingBottom: 56 },
  band: { height: 6, flexDirection: "row" },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: C.muted },
  label: { fontSize: 7, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10 },
  th: { fontSize: 7, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.brandDark },
  td: { paddingVertical: 6 },
  pill: { alignSelf: "flex-end", marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 7.5, fontWeight: 700 },
});
const COLS = [{ w: "26%" }, { w: "6%", r: true }, { w: "13%", r: true }, { w: "13%", r: true }, { w: "11%" }, { w: "15%", r: true }, { w: "16%", r: true }];
const PILL: Record<string, { bg: string; fg: string }> = { mint: { bg: "#e5f6ee", fg: "#1d7550" }, teal: { bg: "#e1f3f1", fg: "#0f6e66" }, amber: { bg: "#fdf2dd", fg: "#94590a" }, rose: { bg: "#fce9e9", fg: "#b42318" }, neutral: { bg: C.surface, fg: C.muted } };

function InvoicePage({ bundle: { invoice: inv, payments, paymentStatus, store } }: { bundle: InvoiceBundle }) {
  const credit = inv.kind === "credit_note";
  const status = credit ? { label: "Credited", tone: "rose" } : PAYMENT_STATUS_META[paymentStatus] ?? { label: paymentStatus, tone: "neutral" };
  const pill = PILL[status.tone] ?? PILL.neutral;
  const etims = ETIMS_META[inv.etims_status];
  const summary = (Object.entries(inv.tax_summary) as [TaxType, { rate: number; taxable: number; tax: number }][]).sort(([a], [b]) => a.localeCompare(b));
  const facts = [["Issued", formatDateTimeFull(inv.issued_at)], ["Order", inv.order?.order_number ?? "—"],
    [credit ? "Credits invoice" : "Currency", credit ? inv.original?.invoice_number ?? "—" : "Kenya Shillings"], ["Amount", kes(inv.total_amount)]];

  return (
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed><View style={{ flex: 3, backgroundColor: C.brand }} /><View style={{ flex: 1, backgroundColor: C.blue }} /></View>
        <View style={s.body}>
          {/* Seller and document */}
          <View style={s.between}>
            <View style={[s.row, { gap: 12 }]}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={{ data: LOGO(), format: "png" }} style={{ width: 70, height: 59.5 }} />
              <View style={{ gap: 1.5 }}>
                <Text style={{ fontSize: 11, fontWeight: 700 }}>{inv.seller_name}</Text>
                <Text style={s.muted}>{store.address}</Text>
                {store.landmark ? <Text style={s.muted}>{store.landmark}</Text> : null}
                <Text style={s.muted}>{[store.phones[0]?.number, store.email].filter(Boolean).join("  ·  ")}</Text>
                <Text style={{ marginTop: 3 }}>KRA PIN  <Text style={{ fontWeight: 700 }}>{inv.seller_kra_pin ?? "Not set"}</Text></Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: C.brand, textTransform: "uppercase" }}>{credit ? "Credit note" : "Tax invoice"}</Text>
              <Text style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{inv.invoice_number}</Text>
              <Text style={[s.pill, { backgroundColor: pill.bg, color: pill.fg }]}>{status.label}</Text>
            </View>
          </View>

          {/* Key facts */}
          <View style={[s.row, { marginTop: 18, borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.surface }]}>
            {facts.map(([k, v], i) => (
              <View key={k} style={{ flex: 1, padding: 8, borderLeftWidth: i ? 1 : 0, borderLeftColor: C.line }}>
                <Text style={s.label}>{k}</Text><Text style={{ marginTop: 2, fontWeight: 600 }}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Parties */}
          <View style={[s.row, { gap: 10, marginTop: 12 }]}>
            <View style={[s.card, { flex: 1 }]}>
              <Text style={s.label}>Billed to</Text>
              <Text style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3 }}>{inv.buyer_name ?? "Walk-in customer"}</Text>
              {inv.buyer_phone ? <Text style={s.muted}>{inv.buyer_phone}</Text> : null}
              <Text style={{ marginTop: 3 }}>KRA PIN  <Text style={{ fontWeight: 700 }}>{inv.buyer_kra_pin ?? "—"}</Text></Text>
            </View>
            <View style={[s.card, { flex: 1 }]}>
              <Text style={s.label}>{credit ? "Refunded" : "Paid with"}</Text>
              {payments.length ? payments.map((p, i) => (
                <View key={i} style={[s.between, { marginTop: 3 }]}>
                  <Text><Text style={{ fontWeight: 700 }}>{PAYMENT_LABEL[p.method]}</Text>{p.provider_reference ? <Text style={s.muted}>{"  " + p.provider_reference}</Text> : null}</Text>
                  <Text>{kes(p.amount)}</Text>
                </View>
              )) : <Text style={[s.muted, { marginTop: 3 }]}>—</Text>}
            </View>
          </View>

          {/* Lines */}
          <View style={{ marginTop: 14, borderWidth: 1, borderColor: C.line, borderRadius: 8 }}>
            <View style={[s.row, { backgroundColor: C.brandSoft, paddingHorizontal: 8, paddingVertical: 7, borderTopLeftRadius: 8, borderTopRightRadius: 8 }]} fixed>
              {["Description", "Qty", "Unit price", "Discount", "VAT", "VAT amount", "Amount"].map((h, i) => (
                <Text key={h} style={[s.th, { width: COLS[i].w, textAlign: COLS[i].r ? "right" : "left", paddingLeft: i ? 6 : 0 }]}>{h}</Text>
              ))}
            </View>
            {inv.lines.map((l, i) => (
              <View key={i} wrap={false} style={[s.row, { paddingHorizontal: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: i % 2 ? "#fbfafb" : "#ffffff" }]}>
                <View style={[s.td, { width: COLS[0].w, paddingRight: 6 }]}><Text style={{ fontWeight: 600 }}>{l.name}</Text>{l.sku ? <Text style={[s.muted, { fontSize: 7.5 }]}>{l.sku}</Text> : null}</View>
                {[String(l.quantity), kes(l.unit_price), l.discount ? `-${kes(l.discount)}` : "—", `${l.tax_type} · ${l.tax_rate}%`, kes(l.tax), kes(l.total)].map((v, j) => (
                  <Text key={j} style={[s.td, { width: COLS[j + 1].w, textAlign: COLS[j + 1].r ? "right" : "left", paddingLeft: 6, fontWeight: j === 5 ? 700 : 400 }]}>{v}</Text>
                ))}
              </View>
            ))}
          </View>

          {/* Tax summary, eTIMS and totals */}
          <View style={[s.row, { gap: 16, marginTop: 14 }]} wrap={false}>
            <View style={{ flex: 1, gap: 10 }}>
              <View>
                <View style={[s.row, { paddingBottom: 4 }]}><Text style={[s.label, { width: "50%" }]}>VAT summary</Text><Text style={[s.label, { width: "25%", textAlign: "right" }]}>Taxable</Text><Text style={[s.label, { width: "25%", textAlign: "right" }]}>VAT</Text></View>
                {summary.map(([t, x]) => (
                  <View key={t} style={[s.row, { paddingVertical: 1.5 }]}><Text style={{ width: "50%" }}>{t} · {TAX_TYPES[t]}</Text><Text style={{ width: "25%", textAlign: "right" }}>{kes(x.taxable)}</Text><Text style={{ width: "25%", textAlign: "right" }}>{kes(x.tax)}</Text></View>
                ))}
              </View>
              <View style={{ backgroundColor: C.surface, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontWeight: 700 }}>KRA eTIMS · <Text style={{ color: PILL[etims.tone]?.fg ?? C.muted }}>{etims.label}</Text></Text>
                <Text style={[s.muted, { marginTop: 3 }]}>
                  {inv.etims_status === "sent"
                    ? `CU invoice no. ${inv.etims_receipt_number} · Signature ${inv.etims_signature}`
                    : `${inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}Not yet transmitted to KRA. The control unit number, signature and QR code are added once eTIMS accepts it.`}
                </Text>
              </View>
            </View>
            <View style={[s.card, { width: 200, padding: 12, gap: 5 }]}>
              <View style={s.between}><Text style={s.muted}>Subtotal (excl. VAT)</Text><Text>{kes(inv.subtotal)}</Text></View>
              {inv.discount_amount > 0 ? <View style={s.between}><Text style={s.muted}>Discount</Text><Text>-{kes(inv.discount_amount)}</Text></View> : null}
              {inv.delivery_amount > 0 ? <View style={s.between}><Text style={s.muted}>Delivery</Text><Text>{kes(inv.delivery_amount)}</Text></View> : null}
              <View style={s.between}><Text style={s.muted}>VAT</Text><Text>{kes(inv.tax_amount)}</Text></View>
              <View style={[s.between, { alignItems: "flex-end", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 7, marginTop: 2 }]}>
                <Text style={{ fontWeight: 700, fontSize: 10 }}>{credit ? "Total credited" : "Total"}</Text>
                <Text style={{ fontWeight: 800, fontSize: 15, color: C.brand }}>{kes(inv.total_amount)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View fixed style={{ position: "absolute", bottom: 20, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <View style={s.between}>
            <Text style={{ fontWeight: 700 }}>Thank you for shopping with {inv.seller_name}!</Text>
            <Text style={s.muted} render={({ pageNumber, totalPages }) => `${inv.invoice_number} · page ${pageNumber} of ${totalPages}`} />
          </View>
          <Text style={[s.muted, { marginTop: 2 }]}>{store.hours}{store.whatsapp ? `  ·  WhatsApp ${store.whatsapp}` : ""}</Text>
        </View>
      </Page>
  );
}

export async function renderInvoicePdf(bundles: InvoiceBundle[]): Promise<Buffer> {
  registerFonts();
  const first = bundles[0].invoice;
  // An order's invoice and credit note go in one document, a page each.
  return renderToBuffer(
    <Document title={bundles.map((b) => b.invoice.invoice_number).join(" + ")} author={first.seller_name} subject={`Order ${first.order?.order_number ?? ""}`}>
      {bundles.map((b) => <InvoicePage key={b.invoice.id} bundle={b} />)}
    </Document>,
  );
}
