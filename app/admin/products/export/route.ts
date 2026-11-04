import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadProductList } from "../list-data";

/** CSV of the products list with the same search, filters and sort as the page (staff only). One row per variant (SKU). */
export async function GET(req: NextRequest) {
  const me = await getProfile();
  if (!me || me.role === "customer") return new NextResponse("Not allowed", { status: 403 });
  const q = req.nextUrl.searchParams;
  const { rows, stock } = await loadProductList({
    q: q.get("q") ?? undefined, category: q.get("category") ?? undefined, brand: q.get("brand") ?? undefined,
    stock: q.get("stock") ?? undefined, show: q.get("show") ?? undefined, sort: q.get("sort") ?? undefined,
  });
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["Product", "Brand", "Category", "Option", "SKU", "Retail (KES)", "Wholesale (KES)", "Available", "Featured", "Visible in shop"].join(",")];
  for (const { p } of rows) {
    for (const v of p.variants) {
      lines.push([p.name, p.brand, p.category.name, v.name ?? "", v.sku, v.price, v.wholesale_price ?? v.price, stock[v.id]?.available ?? 0, p.is_featured ? "Yes" : "No", p.is_active ? "Yes" : "No"].map(cell).join(","));
    }
  }
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sparkle-products-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
