"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/format";

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
  tier: "retail" | "wholesale";
  items: { variant_id: string; quantity: number }[];
  discount: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  mpesaPhone?: string;
};

export type PosSaleResult = { orderId: string; orderNumber: string; total: number; change: number; reference: string };

export async function completeSale(input: PosSaleInput): Promise<ActionResult<PosSaleResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_complete_sale", {
    p_customer_id: input.customerId,
    p_price_tier: input.tier,
    p_items: input.items,
    p_discount: input.discount || 0,
    p_payment_method: input.paymentMethod,
    p_amount_tendered: input.amountTendered ?? null,
    p_mpesa_phone: input.mpesaPhone || null,
  });
  if (error) return fail(error);
  const row = (data as { order_id: string; order_number: string; total_amount: number; change_due: number; payment_reference: string }[])[0];
  revalidatePath("/admin", "layout");
  return { ok: true, data: { orderId: row.order_id, orderNumber: row.order_number, total: Number(row.total_amount), change: Number(row.change_due), reference: row.payment_reference } };
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

  const whatsapp = text(formData, "whatsapp");
  if (whatsapp && whatsapp.replace(/\D/g, "").length < 9) return { ok: false, error: "The WhatsApp number needs at least 9 digits." };
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
  if ([facebook, instagram].some((u) => u && !u.startsWith("https://"))) return { ok: false, error: "Social media links must start with https://" };

  const fees = { nairobi: money(formData, "delivery_fee_nairobi"), other: money(formData, "delivery_fee_other"), free: money(formData, "free_delivery_threshold") };
  if (Object.values(fees).some(Number.isNaN)) return { ok: false, error: "Delivery fees must be numbers of 0 or more." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("store_settings").update({
    name, address, hours, phones,
    landmark: text(formData, "landmark") || null,
    whatsapp: whatsapp || null,
    email: email || null,
    map_embed_url: map || null,
    directions_url: directions || null,
    facebook_url: facebook || null,
    instagram_url: instagram || null,
    delivery_fee_nairobi: fees.nairobi,
    delivery_fee_other: fees.other,
    free_delivery_threshold: fees.free,
    free_delivery_areas: text(formData, "free_delivery_areas").split(",").map((a) => a.trim()).filter(Boolean),
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
  };
  variants: { id?: string; option: string; sku: string; retail: string; wholesale: string; stock: string; reorder_level: string; active: boolean }[];
};

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("admin_create_product", { p_product: input.product, p_variants: input.variants });
  if (error) return fail(error);
  const { data } = await supabase.from("products").select("id").eq("slug", slug as string).single();
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data!.id } };
}

const PHOTO_PREFIX = "/storage/v1/object/public/product-images/";

/** Saves a product; afterwards deletes uploaded photos that were removed from it (only files in our bucket). */
export async function updateProduct(id: string, input: ProductInput, previousPhotos: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_product", { p_id: id, p_product: input.product, p_variants: input.variants });
  if (error) return fail(error);
  const removed = previousPhotos.filter((u) => !input.product.images.includes(u) && u.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL + PHOTO_PREFIX))
    .map((u) => decodeURIComponent(u.slice((process.env.NEXT_PUBLIC_SUPABASE_URL + PHOTO_PREFIX).length)));
  if (removed.length) await supabase.storage.from("product-images").remove(removed);
  revalidatePath("/", "layout");
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
