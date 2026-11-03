import { Document, Font, Image, Page, StyleSheet, Svg, Rect, Text, View, pdf } from "@react-pdf/renderer";
import { kes, PAYMENT_LABEL } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipt";
import type { StoreSettings } from "@/lib/store-types";

// The receipt as a PDF in the same design as components/receipt-document.tsx, on an 80 mm wide
// page exactly as long as the receipt (the page has a width only, so it grows to fit the content), for printing on a till roll and sending to customers.
// Made in the browser (this module is loaded only when someone prints, downloads or shares).

const C = { pink: "#E6007E", navy: "#0F1738", body: "#252B3A", muted: "#6B7280", line: "#D7DCE5", dash: "#9CA3AF", pinkSoft: "#FDEBF3" };
const W = 226.77; // 80 mm in points
const PAD = 17; // ~6 mm each side

let fontsFor: string | null = null;
function registerFonts(origin: string) {
  if (fontsFor === origin) return;
  Font.register({ family: "Inter", fonts: [400, 500, 600, 700].map((w) => ({ src: `${origin}/fonts/inter-latin-${w}.woff`, fontWeight: w })) });
  Font.register({ family: "Script", src: `${origin}/fonts/dancing-script-latin-500.woff` });
  Font.registerHyphenationCallback((word) => [word]);
  fontsFor = origin;
}

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 8.6, color: C.body, paddingHorizontal: PAD, paddingVertical: 14, backgroundColor: "#FFFFFF" },
  center: { textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 1.5 },
  label: { color: C.body },
  value: { color: C.navy, fontWeight: 600 },
  dashed: { borderTopWidth: 0.75, borderTopColor: C.dash, borderStyle: "dashed", marginVertical: 8 },
  solid: { borderTopWidth: 0.75, borderTopColor: C.line, marginVertical: 8 },
});
const COLS = { qty: 24, amount: 62 };

function metaRows(r: ReceiptData, date: string, time: string): [string, string][] {
  const rows: [string, string][] = [["No:", r.number], ["Date:", date], ["Time:", time]];
  if (r.channel === "online") rows.push(["Sold:", "Online shop"]);
  else if (r.cashier) rows.push(["Cashier:", r.cashier]);
  rows.push(["Customer:", r.customer]);
  return rows;
}

function ReceiptPdf({ r, store, origin }: { r: ReceiptData; store: StoreSettings; origin: string }) {
  const d = new Date(r.issuedAt);
  const date = d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
  const time = d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Nairobi" }).toUpperCase();
  const rows = metaRows(r, date, time);
  const cashKept = r.payments.filter((p) => p.method === "cash").reduce((t, p) => t + p.amount, 0);
  const handedOver = r.payments.reduce((t, p) => t + p.amount, 0) - cashKept + (r.cashReceived ?? cashKept);
  const money = (v: string, bold = true) => <Text style={{ color: C.navy, fontWeight: bold ? 600 : 500 }}>{v}</Text>;

  return (
    <Document title={`Receipt ${r.number}`} author={store.name}>
      <Page size={{ width: W }} style={s.page}>
        <View>
        {/* Shop */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={`${origin}/brand/sparkle-logo-invoice.png`} style={{ width: 72, height: 61, alignSelf: "center" }} />
        <Text style={[s.center, { marginTop: 4 }]}>{store.address}</Text>
        {store.landmark ? <Text style={s.center}>{store.landmark}</Text> : null}
        {store.kra_pin ? <Text style={[s.center, { marginTop: 2 }]}><Text style={{ color: C.navy, fontWeight: 600 }}>KRA PIN: </Text>{store.kra_pin}</Text> : null}

        <View style={s.dashed} />
        <Text style={[s.center, { fontSize: 17, fontWeight: 700, color: C.navy }]}>RECEIPT</Text>
        <View style={{ marginTop: 4 }}>
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", marginTop: 1.5 }}><Text style={{ width: 50 }}>{k}</Text><Text style={{ color: C.navy, fontWeight: 500, flex: 1 }}>{v}</Text></View>
          ))}
        </View>
        {r.offline ? <Text style={[s.center, { marginTop: 4, color: C.muted, fontSize: 7.5 }]}>Taken offline · recorded when the till reconnects</Text> : null}

        <View style={s.dashed} />
        {/* Items */}
        <View style={{ flexDirection: "row", backgroundColor: C.pinkSoft, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 4 }}>
          {["Qty", "Item", "Amount"].map((h, i) => (
            <Text key={h} style={{ width: i === 0 ? COLS.qty : i === 2 ? COLS.amount : undefined, flex: i === 1 ? 1 : undefined, textAlign: i === 2 ? "right" : "left",
              fontSize: 7.5, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</Text>
          ))}
        </View>
        {r.lines.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", paddingHorizontal: 5, paddingVertical: 4, borderBottomWidth: 0.75, borderBottomColor: C.line }}>
            <Text style={{ width: COLS.qty, color: C.navy }}>{l.quantity}</Text>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text style={{ color: C.navy, fontWeight: 600, fontSize: 9 }}>{l.name}</Text>
              {l.sku ? <Text style={{ color: C.muted, fontSize: 6.8 }}>{l.sku}</Text> : null}
            </View>
            <Text style={{ width: COLS.amount, textAlign: "right", color: C.navy, fontWeight: 600, fontSize: 9 }}>{kes(l.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 6 }}>
          <View style={s.row}><Text>Subtotal (excl. VAT)</Text>{money(kes(r.subtotal))}</View>
          {r.discount > 0 ? <View style={s.row}><Text>Discount</Text>{money(`-${kes(r.discount)}`)}</View> : null}
          {r.delivery > 0 ? <View style={s.row}><Text>Delivery</Text>{money(kes(r.delivery))}</View> : null}
          {r.tax > 0 ? <View style={s.row}><Text>{r.vatLabel}</Text>{money(kes(r.tax))}</View> : null}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7, backgroundColor: C.pinkSoft, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>TOTAL</Text>
          <Text style={{ fontSize: 17, fontWeight: 700, color: C.pink }}>{kes(r.total)}</Text>
        </View>

        {/* Payment */}
        <View style={s.solid} />
        {r.payments.length === 1 ? (
          <>
            <View style={s.row}><Text>Payment method:</Text>{money(PAYMENT_LABEL[r.payments[0].method], false)}</View>
            {r.payments[0].reference ? <View style={s.row}><Text>Reference:</Text>{money(r.payments[0].reference, false)}</View> : null}
          </>
        ) : r.payments.map((p, i) => <View key={i} style={s.row}><Text>{PAYMENT_LABEL[p.method]}:</Text>{money(kes(p.amount), false)}</View>)}
        <View style={s.row}><Text>Amount paid:</Text>{money(kes(handedOver))}</View>
        {r.change ? <View style={s.row}><Text>Change:</Text>{money(kes(r.change))}</View> : null}
        {r.pointsEarned ? <View style={s.row}><Text style={{ color: C.muted }}>Loyalty points earned</Text><Text style={{ color: C.muted }}>+{r.pointsEarned}</Text></View> : null}
        {r.invoiceNumber ? <View style={s.row}><Text style={{ color: C.muted }}>Tax invoice</Text><Text style={{ color: C.muted }}>{r.invoiceNumber}</Text></View> : null}

        {/* Thanks, eTIMS, slogan */}
        <View style={s.dashed} />
        <Text style={[s.center, { fontFamily: "Script", fontSize: 15, color: C.navy }]}>Thank you for shopping with us.</Text>
        <View style={{ alignItems: "center", marginTop: 6 }}>
          {/* KRA's black-on-white QR once eTIMS accepts the sale; until then an empty, labelled space. */}
          <Svg width={60} height={60} viewBox="0 0 60 60"><Rect x={0.5} y={0.5} width={59} height={59} rx={3} stroke={C.dash} strokeWidth={0.75} strokeDasharray="3 2" fill="none" /></Svg>
          <Text style={{ marginTop: 4, fontSize: 7.5 }}>Scan to verify receipt (eTIMS)</Text>
          <Text style={{ fontSize: 6.8, color: C.muted }}>Available once sent to KRA</Text>
        </View>
        <View style={s.solid} />
        <Text style={[s.center, { fontSize: 7.5, fontWeight: 600, color: C.pink, letterSpacing: 2 }]}>GLOW • SLAY • SPARKLE</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function receiptPdf(r: ReceiptData, store: StoreSettings, origin = window.location.origin): Promise<{ blob: Blob; fileName: string }> {
  registerFonts(origin);
  const blob = await pdf(<ReceiptPdf r={r} store={store} origin={origin} />).toBlob();
  return { blob, fileName: `Receipt_${r.number}_Sparkle.pdf` };
}
