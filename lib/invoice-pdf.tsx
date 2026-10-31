import { Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import { formatDateTimeFull, kes, PAYMENT_LABEL, PAYMENT_STATUS_META } from "@/lib/format";
import { ETIMS_META, vatHeading, type InvoiceBundle } from "@/lib/invoices";
import { TAX_TYPES, type TaxType } from "@/lib/tax";

// A4 PDF of a tax invoice or credit note: Nicholas's invoice template (2026-10-31), laid out like
// components/invoice-document.tsx. Made in the browser when someone clicks View or Download
// (components/invoice-actions.tsx loads this module only then). Fonts and logo are the site's own
// files in public/.

const C = { brand: "#d0237a", brandSoft: "#fdf0f6", brandLine: "#f6c3dd", blue: "#0aa8f2", navy: "#1c2150", ink: "#1f1a1d", muted: "#645c61",
  line: "#e9e4e7", surface: "#f5f5f7", mint: "#1d7550", mintSoft: "#e5f6ee", amber: "#f59e0b", amberSoft: "#fdf2dd", amberText: "#94590a", rose: "#b42318", roseSoft: "#fce9e9" };

let fontsFor: string | null = null;
function registerFonts(origin: string) {
  if (fontsFor === origin) return;
  Font.register({ family: "Jakarta", fonts: [400, 600, 700, 800].map((w) => ({ src: `${origin}/fonts/plus-jakarta-sans-${w}.woff`, fontWeight: w })) });
  Font.register({ family: "Serif", fonts: [
    { src: `${origin}/fonts/dm-serif-display-400-normal.woff` },
    { src: `${origin}/fonts/dm-serif-display-400-italic.woff`, fontStyle: "italic" },
  ] });
  Font.registerHyphenationCallback((word) => [word]);
  fontsFor = origin;
}

const s = StyleSheet.create({
  page: { fontFamily: "Jakarta", fontSize: 9, color: C.ink, paddingBottom: 30 },
  body: { paddingHorizontal: 36, paddingTop: 26 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: C.muted },
  label: { fontSize: 7, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: C.muted },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line },
  card: { backgroundColor: C.surface, borderRadius: 8, padding: 12 },
  th: { fontSize: 7, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: C.ink },
});
// #, Product, Qty, Unit price, Discount, VAT, Amount
const COLS = [{ w: "5%" }, { w: "31%" }, { w: "7%", r: true }, { w: "15%", r: true }, { w: "13%", r: true }, { w: "13%", r: true }, { w: "16%", r: true }];

function InvoicePage({ bundle: { invoice: inv, payments, paymentStatus, store }, origin }: { bundle: InvoiceBundle; origin: string }) {
  const credit = inv.kind === "credit_note";
  const status = credit ? { label: "Credited", tone: "rose" } : PAYMENT_STATUS_META[paymentStatus] ?? { label: paymentStatus, tone: "neutral" };
  const paid = status.tone === "teal" || status.tone === "mint";
  const etims = ETIMS_META[inv.etims_status];
  const vatTitle = vatHeading(inv.lines.map((l) => l.tax_rate));
  const summary = (Object.entries(inv.tax_summary) as [TaxType, { rate: number; taxable: number; tax: number }][]).sort(([a], [b]) => a.localeCompare(b));
  const facts: [string, string][] = [["Issued date", formatDateTimeFull(inv.issued_at)], ["Order no.", inv.order?.order_number ?? "—"],
    [credit ? "Credits invoice" : "Currency", credit ? inv.original?.invoice_number ?? "—" : "Kenya Shillings"]];
  const kv = (k: string, v: string) => (
    <View key={k} style={[s.row, { marginTop: 4 }]}><Text style={[s.muted, { width: 72 }]}>{k}</Text><Text>{v}</Text></View>
  );

  return (
    <Page size="A4" style={s.page}>
      <View style={[s.row, { height: 5 }]} fixed><View style={{ width: "53%", backgroundColor: C.brand }} /><View style={{ flex: 1, backgroundColor: C.blue }} /></View>
      <View style={s.body}>
        {/* Shop and document */}
        <View style={[s.row, s.rule, { paddingBottom: 16 }]}>
          <View style={[s.row, { flex: 1, gap: 12 }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={`${origin}/brand/sparkle-logo-invoice.png`} style={{ width: 74, height: 63 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Serif", fontSize: 18, color: C.navy }}>{inv.seller_name}</Text>
              <Text style={[s.muted, { marginTop: 3 }]}>{store.address}</Text>
              {store.landmark ? <Text style={s.muted}>{store.landmark}</Text> : null}
              <Text style={{ marginTop: 8, fontWeight: 700 }}>KRA PIN: {inv.seller_kra_pin ?? "Not set"}</Text>
            </View>
          </View>
          <View style={{ borderLeftWidth: 1, borderLeftColor: C.line, paddingLeft: 18, width: 170 }}>
            <Text style={s.label}>{credit ? "Credit note" : "Tax invoice"}</Text>
            <Text style={{ fontSize: 26, fontWeight: 800, color: C.navy, marginTop: 2 }}>{inv.invoice_number}</Text>
            <View style={[s.row, { alignSelf: "flex-start", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
              backgroundColor: paid ? C.mintSoft : C.roseSoft }]}>
              {paid && <Svg width={10} height={10} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={12} fill={C.mint} /><Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.6} fill="none" /></Svg>}
              <Text style={{ fontWeight: 600, color: paid ? C.ink : C.rose }}>{status.label}</Text>
            </View>
          </View>
        </View>

        {/* Key facts */}
        <View style={[s.row, s.rule, { paddingVertical: 14 }]}>
          {facts.map(([k, v], i) => (
            <View key={k} style={{ flex: 1, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: C.line }}>
              <Text style={s.label}>{k}</Text><Text style={{ marginTop: 4, fontSize: 10 }}>{v}</Text>
            </View>
          ))}
          <View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: C.line }}>
            <Text style={s.label}>{credit ? "Total credited" : "Total amount"}</Text>
            <Text style={{ marginTop: 2, fontSize: 17, fontWeight: 800, color: C.brand }}>{kes(inv.total_amount)}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={[s.row, { gap: 10, marginTop: 14 }]}>
          <View style={[s.card, { flex: 1.35 }]}>
            <Text style={s.label}>Billed to</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 5 }}>{inv.buyer_name ?? "Walk-in customer"}</Text>
            {inv.buyer_phone ? <Text style={[s.muted, { marginTop: 2 }]}>{inv.buyer_phone}</Text> : null}
            <Text style={[s.muted, { marginTop: 3 }]}>KRA PIN: {inv.buyer_kra_pin ?? "—"}</Text>
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <Text style={s.label}>{credit ? "Refund details" : "Payment details"}</Text>
            {payments.length === 1 ? (
              <View style={{ marginTop: 2 }}>
                {kv("Method", PAYMENT_LABEL[payments[0].method])}
                {kv("Reference", payments[0].provider_reference ?? "—")}
                {kv("Amount paid", kes(payments[0].amount))}
              </View>
            ) : payments.length ? (
              <View style={{ marginTop: 2 }}>
                {payments.map((p, i) => (
                  <View key={i} style={[s.between, { marginTop: 4 }]}>
                    <Text>{PAYMENT_LABEL[p.method]}<Text style={s.muted}>{p.provider_reference ? `  ${p.provider_reference}` : ""}</Text></Text><Text>{kes(p.amount)}</Text>
                  </View>
                ))}
                <View style={[s.between, { marginTop: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.line }]}>
                  <Text style={{ fontWeight: 700 }}>Amount paid</Text><Text style={{ fontWeight: 700 }}>{kes(payments.reduce((a, p) => a + p.amount, 0))}</Text>
                </View>
              </View>
            ) : <Text style={[s.muted, { marginTop: 4 }]}>—</Text>}
          </View>
        </View>

        {/* Lines */}
        <View style={{ marginTop: 14 }}>
          <View style={[s.row, { backgroundColor: C.brandSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 }]} fixed>
            {["#", "Product", "Qty", "Unit price", "Discount", vatTitle, "Amount"].map((h, i) => (
              <Text key={i} style={[s.th, { width: COLS[i].w, textAlign: COLS[i].r ? "right" : "left" }]}>{h}</Text>
            ))}
          </View>
          {inv.lines.map((l, i) => (
            <View key={i} wrap={false} style={[s.row, s.rule, { paddingHorizontal: 8, paddingVertical: 8 }]}>
              <Text style={{ width: COLS[0].w }}>{i + 1}</Text>
              <View style={{ width: COLS[1].w, paddingRight: 6 }}>
                <Text style={{ fontWeight: 700, color: C.navy, fontSize: 9.5 }}>{l.name}</Text>
                {l.sku ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{l.sku}</Text> : null}
              </View>
              <Text style={{ width: COLS[2].w, textAlign: "right" }}>{l.quantity}</Text>
              <Text style={{ width: COLS[3].w, textAlign: "right" }}>{kes(l.unit_price)}</Text>
              <Text style={{ width: COLS[4].w, textAlign: "right" }}>{l.discount ? `-${kes(l.discount)}` : "—"}</Text>
              <View style={{ width: COLS[5].w, alignItems: "flex-end" }}>
                <Text>{kes(l.tax)}</Text>
                {vatTitle === "VAT" ? <Text style={[s.muted, { fontSize: 7 }]}>{l.tax_type} · {l.tax_rate}%</Text> : null}
              </View>
              <Text style={{ width: COLS[6].w, textAlign: "right", fontWeight: 700 }}>{kes(l.total)}</Text>
            </View>
          ))}
        </View>

        {/* Tax summary and totals */}
        <View style={[s.row, { gap: 18, marginTop: 16 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: C.navy }]}>Tax summary</Text>
            <View style={[s.row, s.rule, { marginTop: 6, paddingBottom: 4, paddingHorizontal: 4 }]}>
              <Text style={[s.label, { width: "30%" }]}>Rate</Text><Text style={[s.label, { width: "40%", textAlign: "right" }]}>Taxable amount</Text><Text style={[s.label, { width: "30%", textAlign: "right" }]}>VAT amount</Text>
            </View>
            {summary.map(([t, x]) => (
              <View key={t} style={[s.row, { paddingVertical: 5, paddingHorizontal: 4 }]}>
                <Text style={{ width: "30%" }}>{t} - {TAX_TYPES[t]}</Text><Text style={{ width: "40%", textAlign: "right" }}>{kes(x.taxable)}</Text><Text style={{ width: "30%", textAlign: "right" }}>{kes(x.tax)}</Text>
              </View>
            ))}
            <View style={[s.row, { backgroundColor: C.surface, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 4, marginTop: 2 }]}>
              <Text style={{ width: "30%", fontWeight: 700 }}>Total</Text>
              <Text style={{ width: "40%", textAlign: "right", fontWeight: 700 }}>{kes(summary.reduce((a, [, x]) => a + x.taxable, 0))}</Text>
              <Text style={{ width: "30%", textAlign: "right", fontWeight: 700 }}>{kes(inv.tax_amount)}</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: C.brandSoft, borderRadius: 8, padding: 14, alignSelf: "flex-start" }}>
            <View style={s.between}><Text style={{ fontSize: 10 }}>Subtotal (excl. VAT)</Text><Text style={{ fontSize: 10 }}>{kes(inv.subtotal)}</Text></View>
            {inv.discount_amount > 0 ? <View style={[s.between, { marginTop: 5 }]}><Text style={{ fontSize: 10 }}>Discount</Text><Text style={{ fontSize: 10 }}>-{kes(inv.discount_amount)}</Text></View> : null}
            {inv.delivery_amount > 0 ? <View style={[s.between, { marginTop: 5 }]}><Text style={{ fontSize: 10 }}>Delivery</Text><Text style={{ fontSize: 10 }}>{kes(inv.delivery_amount)}</Text></View> : null}
            <View style={[s.between, { marginTop: 5 }]}><Text style={{ fontSize: 10 }}>{vatTitle}</Text><Text style={{ fontSize: 10 }}>{kes(inv.tax_amount)}</Text></View>
            <View style={[s.between, { alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.brandLine }]}>
              <Text style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{credit ? "Total credited" : "Total"}</Text>
              <Text style={{ fontSize: 18, fontWeight: 800, color: C.brand }}>{kes(inv.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* eTIMS */}
        <View wrap={false} style={[s.row, { gap: 8, marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: inv.etims_status === "sent" ? C.mintSoft : C.amberSoft }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={12} fill={inv.etims_status === "sent" ? C.mint : C.amber} /><Rect x={10.8} y={10} width={2.4} height={8} fill="#fff" /><Circle cx={12} cy={6.6} r={1.5} fill="#fff" /></Svg>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700, color: C.amberText, fontSize: 10 }}>KRA eTIMS – {etims.label}</Text>
            <Text style={{ marginTop: 2 }}>
              {inv.etims_status === "sent"
                ? `CU invoice no. ${inv.etims_receipt_number} · Signature ${inv.etims_signature}`
                : `${inv.etims_status === "failed" && inv.etims_error ? `${inv.etims_error} ` : ""}Not yet transmitted to KRA. The control unit number, signature and QR code are added once eTIMS accepts it.`}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View wrap={false} style={[s.row, { alignItems: "center", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>Thank you for shopping with {inv.seller_name}!</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>{store.hours}</Text>
            <Text style={{ fontFamily: "Serif", fontStyle: "italic", fontSize: 19, color: C.brand, marginTop: 6 }}>Glow · Slay · Sparkle</Text>
          </View>
          <View style={[s.row, { alignItems: "center", gap: 10, borderLeftWidth: 1, borderLeftColor: C.line, paddingLeft: 16 }]}>
            {/* KRA's QR code exists only once eTIMS accepts the invoice, so none is shown before that. */}
            <Svg width={48} height={48} viewBox="0 0 48 48"><Rect x={1} y={1} width={46} height={46} rx={4} stroke={C.line} strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
              <Rect x={14} y={14} width={8} height={8} stroke={C.muted} strokeWidth={1.4} fill="none" /><Rect x={26} y={14} width={8} height={8} stroke={C.muted} strokeWidth={1.4} fill="none" />
              <Rect x={14} y={26} width={8} height={8} stroke={C.muted} strokeWidth={1.4} fill="none" /><Rect x={27} y={27} width={3} height={3} fill={C.muted} /><Rect x={31} y={31} width={3} height={3} fill={C.muted} /></Svg>
            <View style={{ width: 100 }}>
              <Text style={{ fontWeight: 600 }}>Scan for eTIMS verification</Text>
              <Text style={[s.muted, { marginTop: 1 }]}>(Available after transmission)</Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}

/** The PDF and its file name. An order's invoice and credit note go in one document, a page each. */
export async function invoicePdf(bundles: InvoiceBundle[], origin = window.location.origin): Promise<{ blob: Blob; fileName: string }> {
  registerFonts(origin);
  const first = bundles[0].invoice;
  const blob = await pdf(
    <Document title={bundles.map((b) => b.invoice.invoice_number).join(" + ")} author={first.seller_name} subject={`Order ${first.order?.order_number ?? ""}`}>
      {bundles.map((b) => <InvoicePage key={b.invoice.id} bundle={b} origin={origin} />)}
    </Document>,
  ).toBlob();
  return { blob, fileName: `${bundles.map((b) => b.invoice.invoice_number).join("_")}_Sparkle.pdf` };
}
