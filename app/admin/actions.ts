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
