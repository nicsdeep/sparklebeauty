import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "customer" | "staff" | "admin";
  full_name: string | null;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  marketing_consent: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  created_at: string;
};

/** The signed-in user's profile, or null when signed out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

export async function requireUser(next: string) {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return profile;
}

export async function requireStaff() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role === "customer") redirect("/account");
  return profile;
}

/** Demo accounts available for one-click sign-in. Passwords live only in the DEMO_PASSWORD env var. */
export const DEMO_ACCOUNTS = {
  customer: { email: "grace.achieng@example.com", name: "Grace Achieng", next: "/" },
  admin: { email: "admin@sparkle.example", name: "Sparkle Admin", next: "/admin" },
  cashier: { email: "staff@sparkle.example", name: "Esther Wanjiku (Cashier)", next: "/admin/pos" },
} as const;
