"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/format";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: (error as { message?: string })?.message ?? "Something went wrong. Please try again.",
});

/** Current price and availability for cart lines (prices are always re-read from the database). */
export async function quoteCart(variantIds: string[]): Promise<Record<string, { price: number; available: number; low: boolean }>> {
  if (!variantIds.length) return {};
  const supabase = await createClient();
  const [{ data: prices }, { data: stock }] = await Promise.all([
    supabase.from("product_prices").select("variant_id, amount, tier:pricing_tiers!inner(code)").in("variant_id", variantIds).eq("tier.code", "retail"),
    supabase.rpc("get_variant_stock", { p_variant_ids: variantIds }),
  ]);
  const out: Record<string, { price: number; available: number; low: boolean }> = {};
  for (const id of variantIds) out[id] = { price: 0, available: 0, low: false };
  for (const p of prices ?? []) out[p.variant_id].price = Number(p.amount);
  for (const s of (stock ?? []) as { variant_id: string; quantity_available: number; low_stock: boolean }[]) {
    out[s.variant_id].available = s.quantity_available;
    out[s.variant_id].low = s.low_stock;
  }
  return out;
}

/** Checks a promo code against the subtotal; the database re-checks it when the order is placed. */
export async function checkPromo(code: string, subtotal: number): Promise<ActionResult<{ code: string; discount: number; label: string }>> {
  const supabase = await createClient();
  const { data } = await supabase.from("promotions").select("code, name, discount_type, discount_value, minimum_order_amount")
    .ilike("code", code.trim()).maybeSingle();
  if (!data) return { ok: false, error: `Promo code ${code.trim().toUpperCase()} is not valid.` };
  if (subtotal < Number(data.minimum_order_amount)) {
    return { ok: false, error: `${data.code} needs a minimum order of KES ${Number(data.minimum_order_amount).toLocaleString("en-KE")}.` };
  }
  const discount = Math.min(subtotal, data.discount_type === "percentage" ? Math.round((subtotal * Number(data.discount_value)) / 100) : Number(data.discount_value));
  return { ok: true, data: { code: data.code!, discount, label: data.name } };
}

export type PlaceOrderInput = {
  items: { variant_id: string; quantity: number }[];
  contact: { full_name: string; phone: string; email: string };
  delivery: { method: "delivery" | "pickup"; address_line1?: string; address_line2?: string; city?: string; county?: string; notes?: string; save?: boolean };
  paymentMethod: PaymentMethod;
  promoCode?: string;
};

export async function placeOrder(input: PlaceOrderInput): Promise<ActionResult<{ orderId: string; orderNumber: string; total: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_items: input.items,
    p_contact: input.contact,
    p_delivery: input.delivery,
    p_payment_method: input.paymentMethod,
    p_promo_code: input.promoCode || null,
  });
  if (error) return fail(error);
  const row = (data as { order_id: string; order_number: string; total_amount: number }[])[0];
  revalidatePath("/account");
  return { ok: true, data: { orderId: row.order_id, orderNumber: row.order_number, total: Number(row.total_amount) } };
}

export async function payOrder(orderId: string, phone?: string): Promise<ActionResult<{ reference: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pay_order", { p_order_id: orderId, p_phone: phone || null });
  if (error) return fail(error);
  revalidatePath("/account");
  return { ok: true, data: { reference: data as string } };
}

export async function toggleWishlist(productId: string): Promise<ActionResult<{ saved: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signin" };
  let { data: list } = await supabase.from("wishlists").select("id").eq("user_id", user.id).maybeSingle();
  if (!list) {
    const created = await supabase.from("wishlists").insert({ user_id: user.id }).select("id").single();
    if (created.error) return fail(created.error);
    list = created.data;
  }
  const { data: existing } = await supabase.from("wishlist_items").select("product_id").eq("wishlist_id", list.id).eq("product_id", productId).maybeSingle();
  const res = existing
    ? await supabase.from("wishlist_items").delete().eq("wishlist_id", list.id).eq("product_id", productId)
    : await supabase.from("wishlist_items").insert({ wishlist_id: list.id, product_id: productId });
  if (res.error) return fail(res.error);
  revalidatePath("/account");
  return { ok: true, data: { saved: !existing } };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/account");
}

export async function updatePreferences(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({
    full_name: String(formData.get("full_name") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notify_email: formData.get("notify_email") === "on",
    notify_sms: formData.get("notify_sms") === "on",
    notify_whatsapp: formData.get("notify_whatsapp") === "on",
    marketing_consent: formData.get("marketing_consent") === "on",
  }).eq("id", user.id);
  revalidatePath("/account");
}

/** Saves a review; submit_review() checks the customer bought the product and updates its rating. */
export async function submitReview(productId: string, slug: string, rating: number, body: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", { p_product_id: productId, p_rating: rating, p_body: body });
  if (error) return fail(error);
  revalidatePath(`/product/${slug}`);
  return { ok: true, data: undefined };
}

/** Changes the signed-in customer's password after checking the current one. */
export async function changePassword(formData: FormData): Promise<ActionResult> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return { ok: false, error: "Choose a new password of at least 8 characters." };
  if (next !== String(formData.get("confirm") ?? "")) return { ok: false, error: "The new passwords don't match." };
  if (next === current) return { ok: false, error: "Choose a password different from the current one." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Please sign in again." };
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { ok: false, error: "Your current password is not correct." };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}
