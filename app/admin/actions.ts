"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/format";
import { KRA_PIN, type TaxType } from "@/lib/tax";
import { toQuoteLine, type PriceBreak, type PriceRule, type QuoteLine } from "@/lib/pricing";
import { ANNOUNCEMENT_ICONS } from "@/lib/announcement-types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: (e as { message?: string })?.message ?? "Something went wrong." });

// Every action calls a database function that re-checks the caller is staff (or admin).

export async function advanceOrder(orderId: string, note?: string): Promise<ActionResult<{ status: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_order", { p_order_id: orderId, p_note: note || null });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: { status: data as string } };
}

/** When the order should reach the customer (shown on their tracking page); null clears it. */
export async function setDeliveryEstimate(orderId: string, at: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_delivery_estimate", { p_order_id: orderId, p_at: at });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: undefined };
}

export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId, p_reason: reason || null });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: undefined };
}

export async function adjustStock(variantId: string, delta: number, reason: string): Promise<ActionResult<{ quantity: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_stock", { p_variant_id: variantId, p_delta: Math.trunc(delta), p_reason: reason });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: { quantity: data as number } };
}

export type PosSaleInput = {
  customerId: string | null;
  items: { variant_id: string; quantity: number }[];
  discount: number;
  /** One or more payments that together cover the total (split payment). */
  payments: PosPayment[];
  /** Unique per sale, so a retried or offline-synced sale is never recorded twice. */
  clientRef: string;
  /** Set when the sale was taken while the till was offline. */
  offlineAt?: string;
  /** Set when paying for a resumed suspended sale: its stock hold is released as the sale is recorded. */
  suspensionId?: string;
};

/** cash: amount received (change comes out of it); other methods: amount charged to them. */
export type PosPayment = { method: PosPaymentMethod; amount: number; phone?: string; reference?: string };
export type PosPaymentMethod = Exclude<PaymentMethod, "other">;
export type PosRecordedPayment = { method: PosPaymentMethod; amount: number; reference: string };
/** lineTotal is before discount; amount is what the customer pays for the line (VAT included). */
export type PosReceiptLine = { name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; amount: number; rule: PriceRule };
export type PosSaleResult = {
  orderId: string; orderNumber: string; total: number; tax: number; change: number; payments: PosRecordedPayment[]; duplicate: boolean; lines: PosReceiptLine[];
  /** Tax invoice issued for the sale (waiting in the eTIMS queue until the KRA link is set up). */
  invoiceNumber: string | null;
  /** Private receipt link token (/r/<token>) to send the customer. */
  receiptToken: string | null;
};

/** Completes a till sale; the database prices every line with the shared engine and deducts stock atomically. */
export async function completeSale(input: PosSaleInput): Promise<ActionResult<PosSaleResult>> {
  const supabase = await createClient();
  const sale = {
    p_customer_id: input.customerId,
    p_items: input.items,
    p_discount: input.discount || 0,
    p_payments: input.payments.map((p) => ({ method: p.method, amount: p.amount, phone: p.phone || null, reference: p.reference || null })),
    p_client_ref: input.clientRef,
  };
  const { data, error } = input.suspensionId
    ? await supabase.rpc("pos_complete_suspended_sale", { p_suspension_id: input.suspensionId, ...sale })
    : await supabase.rpc("pos_complete_sale", { ...sale, p_offline_at: input.offlineAt ?? null });
  if (error) return fail(error);
  const row = (data as { order_id: string; order_number: string; total_amount: number; change_due: number; payments: PosRecordedPayment[]; duplicate: boolean }[])[0];
  const [{ data: lines }, { data: order }, { data: invoice }] = await Promise.all([
    supabase.from("order_items").select("product_name, sku, quantity, unit_price, line_total, discount_amount, tax_amount, price_rule").eq("order_id", row.order_id),
    supabase.from("orders").select("tax_amount, receipt_token, prices_include_vat").eq("id", row.order_id).single(),
    supabase.from("invoices").select("invoice_number").eq("order_id", row.order_id).eq("kind", "invoice").maybeSingle(),
  ]);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    data: {
      orderId: row.order_id, orderNumber: row.order_number, total: Number(row.total_amount), change: Number(row.change_due),
      tax: Number(order?.tax_amount ?? 0), invoiceNumber: invoice?.invoice_number ?? null, receiptToken: order?.receipt_token ?? null,
      payments: row.payments.map((p) => ({ ...p, amount: Number(p.amount) })), duplicate: row.duplicate,
      lines: (lines ?? []).map((l) => ({ name: l.product_name, sku: l.sku ?? "", quantity: l.quantity, unitPrice: Number(l.unit_price),
        lineTotal: Number(l.line_total), amount: Math.round((Number(l.line_total) - Number(l.discount_amount) + (order?.prices_include_vat ? 0 : Number(l.tax_amount))) * 100) / 100,
        rule: (l.price_rule ?? "retail") as PriceRule })),
    },
  };
}

// Suspended sales: held in the database with their stock for 24 hours (see migration 20261104120000).

export type PosSuspension = {
  id: string; reference: string; customerId: string | null; customerName: string | null; customerPhone: string | null;
  discountPct: number; notes: string | null; expiresAt: string; createdAt: string;
  items: { variantId: string; name: string; quantity: number; unitPrice: number }[];
};

/** Active suspended sales, newest first. Releases any whose time has run out before reading. */
export async function listSuspensions(): Promise<ActionResult<PosSuspension[]>> {
  const supabase = await createClient();
  await supabase.rpc("expire_pos_suspensions");
  const { data, error } = await supabase.from("pos_suspensions")
    .select("id, reference, customer_id, customer_name, customer_phone, discount_pct, notes, expires_at, created_at, pos_suspension_items(variant_id, name, quantity, unit_price)")
    .eq("status", "active").order("created_at", { ascending: false });
  if (error) return fail(error);
  return {
    ok: true,
    data: (data ?? []).map((s) => ({
      id: s.id, reference: s.reference, customerId: s.customer_id, customerName: s.customer_name, customerPhone: s.customer_phone,
      discountPct: Number(s.discount_pct), notes: s.notes, expiresAt: s.expires_at, createdAt: s.created_at,
      items: (s.pos_suspension_items as { variant_id: string; name: string; quantity: number; unit_price: number }[])
        .map((i) => ({ variantId: i.variant_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
    })),
  };
}

/** Suspends the cart: saves it and holds its stock (Available drops on every channel at once). */
export async function suspendSale(input: { customerId: string | null; items: { variant_id: string; quantity: number }[]; discountPct: number; notes?: string }): Promise<ActionResult<{ reference: string; expiresAt: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_suspend_sale", {
    p_customer_id: input.customerId, p_items: input.items, p_discount_pct: input.discountPct || 0, p_notes: input.notes || null,
  });
  if (error) return fail(error);
  const row = (data as { reference: string; expires_at: string }[])[0];
  revalidatePath("/admin", "layout");
  return { ok: true, data: { reference: row.reference, expiresAt: row.expires_at } };
}

export async function extendSuspension(id: string, expiresAt: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_extend_suspension", { p_id: id, p_expires_at: expiresAt });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

/** Ends a suspension and returns its held stock to Available. */
export async function releaseSuspension(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_release_suspension", { p_id: id });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: undefined };
}

/** Price breaks from the pricing engine for every product, for the selected customer (null = walk-in). */
export async function posPriceSheet(customerId: string | null): Promise<ActionResult<Record<string, PriceBreak[]>>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_price_sheet", { p_customer_id: customerId });
  if (error) return fail(error);
  const sheet: Record<string, PriceBreak[]> = {};
  for (const r of (data ?? []) as { variant_id: string; min_qty: number; unit_price: number; rule: PriceRule }[]) {
    (sheet[r.variant_id] ??= []).push({ min_qty: Number(r.min_qty), unit_price: Number(r.unit_price), rule: r.rule });
  }
  return { ok: true, data: sheet };
}

/** Server confirmation of a till cart: engine prices plus live availability per line. */
export async function posQuote(customerId: string | null, items: { variant_id: string; quantity: number }[]): Promise<ActionResult<QuoteLine[]>> {
  if (!items.length) return { ok: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_quote", { p_customer_id: customerId, p_items: items });
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(toQuoteLine) };
}

export async function resetDemo(formData: FormData): Promise<ActionResult> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESET") {
    return { ok: false, error: "Type RESET to confirm." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_demo");
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// Settings (admins only: enforced by RLS on store_settings and by the user functions) -------

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const money = (f: FormData, k: string) => {
  const n = Number(text(f, k).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
};

export async function saveStoreSettings(formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const address = text(formData, "address");
  const hours = text(formData, "hours");
  if (!name || !address || !hours) return { ok: false, error: "Shop name, address and opening hours are required." };

  const labels = formData.getAll("phone_label").map(String);
  const phones = formData.getAll("phone_number").map(String)
    .map((number, i) => ({ label: (labels[i] ?? "").trim() || `Line ${i + 1}`, number: number.trim() }))
    .filter((p) => p.number);
  if (phones.some((p) => p.number.replace(/\D/g, "").length < 9)) return { ok: false, error: "Each phone number needs at least 9 digits." };

  const waLabels = formData.getAll("wa_label").map(String);
  const whatsappContacts = formData.getAll("wa_number").map(String)
    .map((number, i) => ({ label: (waLabels[i] ?? "").trim() || `WhatsApp ${i + 1}`, number: number.trim() }))
    .filter((p) => p.number);
  if (whatsappContacts.some((p) => p.number.replace(/\D/g, "").length < 9)) return { ok: false, error: "Each WhatsApp number needs at least 9 digits." };
  if (whatsappContacts.length > 8) return { ok: false, error: "Up to 8 WhatsApp contacts." };
  const email = text(formData, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };

  // Accept either the embed URL or the full <iframe> snippet Google gives you.
  const mapRaw = text(formData, "map_embed_url");
  const map = mapRaw.match(/src="([^"]+)"/)?.[1] ?? mapRaw;
  if (map && !map.startsWith("https://www.google.com/maps/embed")) return { ok: false, error: "The map must be a Google Maps embed link (Share → Embed a map)." };
  const directions = text(formData, "directions_url");
  if (directions && !directions.startsWith("https://")) return { ok: false, error: "The directions link must start with https://" };
  const facebook = text(formData, "facebook_url");
  const instagram = text(formData, "instagram_url");
  const tiktok = text(formData, "tiktok_url");
  const youtube = text(formData, "youtube_url");
  if ([facebook, instagram, tiktok, youtube].some((u) => u && !u.startsWith("https://"))) return { ok: false, error: "Social media links must start with https://" };

  const kraPin = text(formData, "kra_pin").toUpperCase();
  if (kraPin && !KRA_PIN.test(kraPin)) return { ok: false, error: "A KRA PIN is a letter, 9 digits and a letter, e.g. P051234567X." };

  const fees = { nairobi: money(formData, "delivery_fee_nairobi"), other: money(formData, "delivery_fee_other"), free: money(formData, "free_delivery_threshold") };
  if (Object.values(fees).some(Number.isNaN)) return { ok: false, error: "Delivery fees must be numbers of 0 or more." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("store_settings").update({
    name, address, hours, phones,
    landmark: text(formData, "landmark") || null,
    whatsapp_contacts: whatsappContacts,
    email: email || null,
    map_embed_url: map || null,
    directions_url: directions || null,
    facebook_url: facebook || null,
    instagram_url: instagram || null,
    tiktok_url: tiktok || null,
    youtube_url: youtube || null,
    delivery_fee_nairobi: fees.nairobi,
    delivery_fee_other: fees.other,
    free_delivery_threshold: fees.free,
    free_delivery_areas: text(formData, "free_delivery_areas").split(",").map((a) => a.trim()).filter(Boolean),
    kra_pin: kraPin || null,
    vat_registered: formData.get("vat_registered") === "on",
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  }).eq("id", true).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only an admin can change shop settings." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveStaffUser(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_staff_user", {
    p_email: text(formData, "email"),
    p_full_name: text(formData, "full_name"),
    p_phone: text(formData, "phone") || null,
    p_role: text(formData, "role") === "admin" ? "admin" : "staff",
    p_password: String(formData.get("password") ?? "") || null,
  });
  if (error) return fail(error);
  revalidatePath("/admin/settings");
  return { ok: true, data: undefined };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_active", { p_user_id: userId, p_active: active });
  if (error) return fail(error);
  revalidatePath("/admin/settings");
  return { ok: true, data: undefined };
}

// Homepage hero (admins only: enforced by RLS on hero_banners) ------------------------------

const safeHref = (v: string) => (v.startsWith("/") || v.startsWith("https://") ? v : "");

export async function saveHeroBanner(formData: FormData): Promise<ActionResult> {
  const title = text(formData, "title");
  const imageUrl = text(formData, "image_url");
  if (!title) return { ok: false, error: "The heading is required." };
  if (!imageUrl || !(imageUrl.startsWith("/") || imageUrl.startsWith("https://"))) {
    return { ok: false, error: "The banner image must be a site path (e.g. /brand/hero-banner.jpg) or an https:// link." };
  }
  const primaryHref = safeHref(text(formData, "primary_href"));
  const secondaryHref = safeHref(text(formData, "secondary_href"));
  if (!primaryHref) return { ok: false, error: "Button links must start with / or https://" };

  const row = {
    image_url: imageUrl,
    image_alt: text(formData, "image_alt"),
    image_focus: ["25% center", "50% center", "72% center", "90% center"].includes(text(formData, "image_focus")) ? text(formData, "image_focus") : "72% center",
    eyebrow: text(formData, "eyebrow") || null,
    title,
    title_accent: text(formData, "title_accent") || null,
    body: text(formData, "body") || null,
    primary_label: text(formData, "primary_label") || "Shop Now",
    primary_href: primaryHref,
    secondary_label: text(formData, "secondary_label") || null,
    secondary_href: secondaryHref || null,
    trust_text: text(formData, "trust_text") || null,
    show_logo: formData.get("show_logo") === "on",
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const id = text(formData, "id");
  const res = id
    ? await supabase.from("hero_banners").update({ ...row, updated_by: user?.id ?? null }).eq("id", id).select("id")
    : await supabase.from("hero_banners").insert({ ...row, updated_by: user?.id ?? null }).select("id");
  if (res.error) return fail(res.error);
  if (!res.data?.length) return { ok: false, error: "Only an admin can change the homepage banner." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export type AnnouncementInput = { id: string | null; text: string; mobile_text: string; icon: string; href: string; is_active: boolean };

/** Saves the announcement bar: the list as shown (its order becomes sort_order); rows left out are deleted. */
export async function saveAnnouncements(rows: AnnouncementInput[]): Promise<ActionResult<{ ids: string[] }>> {
  if (rows.length > 8) return { ok: false, error: "Up to 8 announcements." };
  for (const [i, r] of rows.entries()) {
    const n = `Announcement ${i + 1}`;
    if (!r.text.trim()) return { ok: false, error: `${n} needs its text.` };
    if (r.text.trim().length > 120) return { ok: false, error: `${n}: keep the text under 120 characters.` };
    if (r.mobile_text.trim().length > 60) return { ok: false, error: `${n}: keep the phone text under 60 characters so it fits on one line.` };
    if (!(ANNOUNCEMENT_ICONS as readonly string[]).includes(r.icon)) return { ok: false, error: `${n}: choose an icon.` };
    if (r.href.trim() && !safeHref(r.href.trim())) return { ok: false, error: `${n}: links must start with / or https://` };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const keep = rows.map((r) => r.id).filter((id): id is string => !!id);
  const { data: existing, error: readError } = await supabase.from("announcements").select("id");
  if (readError) return fail(readError);
  const gone = (existing ?? []).map((e) => e.id).filter((id) => !keep.includes(id));
  if (gone.length) {
    const { data, error } = await supabase.from("announcements").delete().in("id", gone).select("id");
    if (error) return fail(error);
    if (data.length !== gone.length) return { ok: false, error: "Only an admin can change the announcement bar." };
  }
  const ids: string[] = [];
  for (const [i, r] of rows.entries()) {
    const row = { text: r.text.trim(), mobile_text: r.mobile_text.trim() || null, icon: r.icon, href: r.href.trim() || null,
      is_active: r.is_active, sort_order: i + 1, updated_at: now, updated_by: user?.id ?? null };
    const res = r.id ? await supabase.from("announcements").update(row).eq("id", r.id).select("id")
      : await supabase.from("announcements").insert(row).select("id");
    if (res.error) return fail(res.error);
    if (!res.data?.length) return { ok: false, error: "Only an admin can change the announcement bar." };
    ids.push(res.data[0].id);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { ids } };
}

// Quick-action create flows ----------------------------------------------------------------

export async function createCustomer(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const wholesale = formData.get("type") === "wholesale";
  if (wholesale && !text(formData, "business_name")) return { ok: false, error: "Enter the business name for a wholesale customer." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_customer", {
    p_full_name: text(formData, "full_name"),
    p_phone: text(formData, "phone"),
    p_email: text(formData, "email") || null,
    p_business_name: wholesale ? text(formData, "business_name") || null : null,
    p_business_location: wholesale ? text(formData, "business_location") || null : null,
  });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return { ok: true, data: { id: data as string } };
}

export type ProductInput = {
  product: {
    name: string; category_slug: string; brand: string; description: string; images: string[]; is_featured: boolean; is_active: boolean;
    benefits: string[]; how_to_use: string; ingredients: string; option_type: string; hair_texture: string; hair_type: string;
    /** KRA eTIMS tax type (B = VAT 16%). Saved to products.tax_type after the product itself. */
    tax_type: TaxType;
  };
  /** option2: the second part of a two-part option (colour_length, colour_size); barcode is optional. */
  variants: { id?: string; option: string; option2?: string; sku: string; barcode?: string; retail: string; wholesale: string; stock: string; reorder_level: string; active: boolean }[];
};

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("admin_create_product", { p_product: input.product, p_variants: input.variants });
  if (error) return fail(error);
  const { data } = await supabase.from("products").select("id").eq("slug", slug as string).single();
  const { error: taxError } = await supabase.from("products").update({ tax_type: input.product.tax_type }).eq("id", data!.id);
  if (taxError) return fail(taxError);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data!.id } };
}

const PHOTO_PREFIX = "/storage/v1/object/public/product-images/";

/** Saves a product; afterwards deletes uploaded photos that were removed from it (only files in our bucket). */
export async function updateProduct(id: string, input: ProductInput, previousPhotos: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_product", { p_id: id, p_product: input.product, p_variants: input.variants });
  if (error) return fail(error);
  const { error: taxError } = await supabase.from("products").update({ tax_type: input.product.tax_type }).eq("id", id);
  if (taxError) return fail(taxError);
  const removed = previousPhotos.filter((u) => !input.product.images.includes(u) && u.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL + PHOTO_PREFIX))
    .map((u) => decodeURIComponent(u.slice((process.env.NEXT_PUBLIC_SUPABASE_URL + PHOTO_PREFIX).length)));
  if (removed.length) await supabase.storage.from("product-images").remove(removed);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Sets (or clears) a customer's KRA PIN for their tax invoices. */
export async function setCustomerKraPin(customerId: string, pin: string): Promise<ActionResult> {
  const value = pin.trim().toUpperCase();
  if (value && !KRA_PIN.test(value)) return { ok: false, error: "A KRA PIN is a letter, 9 digits and a letter, e.g. A012345678Z." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ kra_pin: value || null }).eq("id", customerId).eq("role", "customer").select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Customer not found." };
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true, data: undefined };
}

/** Gives a customer online access: their email plus a temporary password that staff share privately. */
export async function setCustomerLogin(customerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_customer_login", {
    p_customer_id: customerId, p_email: text(formData, "email"), p_password: String(formData.get("password") ?? ""),
  });
  if (error) return fail(error);
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true, data: undefined };
}

export async function createPromotion(formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const code = text(formData, "code").toUpperCase().replace(/\s+/g, "");
  const type = formData.get("discount_type") === "fixed" ? "fixed" : "percentage";
  const value = Number(formData.get("discount_value"));
  const minimum = Number(formData.get("minimum_order_amount") || 0);
  const starts = text(formData, "starts_at");
  const ends = text(formData, "ends_at");
  if (!name) return { ok: false, error: "Enter a name for the promotion." };
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return { ok: false, error: "The code needs 3 to 20 letters or numbers, e.g. SPARKLE10." };
  if (!(value > 0) || (type === "percentage" && value > 90)) return { ok: false, error: type === "percentage" ? "Enter a discount between 1% and 90%." : "Enter a discount amount in KES." };
  if (!(minimum >= 0)) return { ok: false, error: "The minimum order can't be negative." };
  // Dates are entered as Nairobi calendar days: from the start of the first day to the end of the last.
  const startsAt = starts ? new Date(`${starts}T00:00:00+03:00`) : new Date();
  const endsAt = ends ? new Date(`${ends}T23:59:59+03:00`) : null;
  if (endsAt && endsAt <= startsAt) return { ok: false, error: "The end date must be after the start date." };

  const supabase = await createClient();
  const { error } = await supabase.from("promotions").insert({
    name, code, description: text(formData, "description") || null, discount_type: type, discount_value: value,
    minimum_order_amount: minimum, starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
    is_active: formData.get("is_active") === "on",
  });
  if (error) return error.code === "23505" ? { ok: false, error: `The code ${code} is already used by another promotion.` } : fail(error);
  revalidatePath("/admin/promotions");
  return { ok: true, data: undefined };
}

/** Saves a negotiated price for one customer and product code (RLS: staff only). */
export async function setCustomerPrice(customerId: string, formData: FormData): Promise<ActionResult> {
  const sku = text(formData, "sku").toUpperCase();
  const amount = Number(formData.get("amount"));
  if (!(amount > 0)) return { ok: false, error: "Enter a price in KES." };
  const supabase = await createClient();
  const { data: variant } = await supabase.from("product_variants").select("id").eq("sku", sku).maybeSingle();
  if (!variant) return { ok: false, error: `No product with code ${sku}.` };
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("customer_prices").upsert({
    customer_id: customerId, variant_id: variant.id, amount, note: text(formData, "note") || null, created_by: user?.id ?? null, updated_at: new Date().toISOString(),
  });
  if (error) return fail(error);
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true, data: undefined };
}

export async function removeCustomerPrice(customerId: string, variantId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customer_prices").delete().eq("customer_id", customerId).eq("variant_id", variantId);
  if (error) return fail(error);
  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true, data: undefined };
}
