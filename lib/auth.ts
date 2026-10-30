import { redirect } from "next/navigation";
import { cache } from "react";
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

/** The signed-in auth user, checked once per request however many layouts and pages ask. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/** The signed-in user's profile, or null when signed out (once per request). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

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
