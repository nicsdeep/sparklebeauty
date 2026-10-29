import Link from "next/link";
import type { Metadata } from "next";
import { LayoutDashboard, ShoppingBag, Store } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { demoSignIn, signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const DEMOS = [
  { account: "customer", Icon: ShoppingBag, title: "Shop as Grace Achieng", text: "Customer · grace.achieng@example.com" },
  { account: "admin", Icon: LayoutDashboard, title: "Sparkle Admin", text: "Dashboard, orders, CRM, reports, AI" },
  { account: "cashier", Icon: Store, title: "Shop cashier", text: "Point of sale (POS)" },
] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Card className="p-6">
          <h1 className="text-2xl font-bold">Welcome</h1>
          <p className="mt-1 text-ink-muted">Choose a demo account to continue.</p>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-bg px-4 py-3 text-sm text-rose-fg">
              {error === "demo" ? "Demo sign-in isn't configured. Check DEMO_PASSWORD." : "That email and password didn't match."}
            </p>
          )}
          <div className="mt-5 space-y-3">
            {DEMOS.map(({ account, Icon, title, text }) => (
              <form key={account} action={demoSignIn}>
                <input type="hidden" name="account" value={account} />
                {next && account === "customer" && <input type="hidden" name="next" value={next} />}
                {next?.startsWith("/admin") && account !== "customer" && <input type="hidden" name="next" value={next} />}
                <button className="flex w-full items-center gap-4 rounded-2xl border border-line p-4 text-left transition hover:border-brand-500 hover:bg-brand-50">
                  <span className="rounded-full bg-brand-50 p-3 text-brand-600"><Icon className="size-5" /></span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-ink-muted">{text}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Sign in with email instead</summary>
            <form action={signIn} className="mt-4 space-y-4">
              {next && <input type="hidden" name="next" value={next} />}
              <Field label="Email"><input name="email" type="email" required className={inputClass} autoComplete="email" /></Field>
              <Field label="Password"><input name="password" type="password" required className={inputClass} autoComplete="current-password" /></Field>
              <Button className="w-full">Sign In</Button>
            </form>
          </details>
        </Card>
        <p className="mt-6 text-center"><Link href="/" className="font-semibold text-brand-700">← Back to the shop</Link></p>
      </div>
    </div>
  );
}
