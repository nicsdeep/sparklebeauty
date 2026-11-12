import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadPhotoTargets } from "../data";

/** CSV shot list: every shown product that has no photo yet, with the codes to name the files by (staff only). */
export async function GET() {
  const me = await getProfile();
  if (!me || me.role === "customer") return new NextResponse("Not allowed", { status: 403 });
  const targets = (await loadPhotoTargets()).filter((t) => t.photos === 0);
  const byProduct = new Map<string, typeof targets>();
  for (const t of targets) byProduct.set(t.productId, [...(byProduct.get(t.productId) ?? []), t]);
  const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [["Product", "Category", "Name the photo file", "Product code", "Shelf label codes (barcodes)", "Options"].join(",")];
  for (const items of [...byProduct.values()].sort((a, b) => a[0].category.localeCompare(b[0].category) || a[0].productName.localeCompare(b[0].productName))) {
    const first = items[0];
    const code = first.sku.replace(/-\d{2}$/, "");
    const label = items.find((i) => i.barcode)?.barcode;
    lines.push([first.productName, first.category, `${label ?? code}.jpg`, code, items.map((i) => i.barcode).filter(Boolean).join(" "),
      items.map((i) => i.variant).filter(Boolean).join("; ")].map(cell).join(","));
  }
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sparkle-products-without-photos-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
