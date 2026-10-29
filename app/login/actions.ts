"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS } from "@/lib/auth";

const safeNext = (next: FormDataEntryValue | null, fallback: string) => {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
};

/** One-click sign-in for the demo accounts. The password never reaches the browser. */
export async function demoSignIn(formData: FormData) {
  const key = formData.get("account") as keyof typeof DEMO_ACCOUNTS;
  const account = DEMO_ACCOUNTS[key];
  const password = process.env.DEMO_PASSWORD;
  if (!account || !password) redirect("/login?error=demo");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error) redirect("/login?error=demo");
  redirect(safeNext(formData.get("next"), account.next));
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  const next = safeNext(formData.get("next"), "/account");
  if (error) redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
