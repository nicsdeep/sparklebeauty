import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckoutWizard, type SavedAddress } from "./wizard";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const profile = await getProfile();
  let addresses: SavedAddress[] = [];
  if (profile) {
    const supabase = await createClient();
    const { data } = await supabase.from("customer_addresses").select("id, label, address_line1, address_line2, city, county, is_default")
      .eq("user_id", profile.id).order("is_default", { ascending: false });
    addresses = (data ?? []) as SavedAddress[];
  }
  return (
    <CheckoutWizard
      profile={profile ? { full_name: profile.full_name ?? "", phone: profile.phone ?? "", email: profile.email ?? "" } : null}
      addresses={addresses}
    />
  );
}
