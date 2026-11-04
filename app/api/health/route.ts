import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Keep-alive / health check (docs/supabase-keep-alive.md). Vercel Cron calls this once a day with
// "Authorization: Bearer <CRON_SECRET>". It runs one tiny read-only query (public.ping(), which
// returns the database time) so a free-tier Supabase project isn't paused for inactivity.
// It touches no business data, writes nothing and never retries: the next scheduled run tries again.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function log(status: "started" | "ok" | "failed" | "unauthorized" | "not_configured", extra: Record<string, unknown> = {}) {
  // One line per event; never secrets or data, only what happened and when.
  console.info(JSON.stringify({ event: "health_check", status, at: new Date().toISOString(), ...extra }));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    log("not_configured");
    return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"))) {
    log("unauthorized");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  log("started");
  const started = Date.now();
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("ping");
    const ms = Date.now() - started;
    if (error) {
      log("failed", { ms, error: error.message.slice(0, 200) });
      return Response.json({ ok: false, error: "Database check failed" }, { status: 503 });
    }
    log("ok", { ms });
    return Response.json({ ok: true, database_time: data, ms }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    log("failed", { ms: Date.now() - started, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return Response.json({ ok: false, error: "Database check failed" }, { status: 503 });
  }
}
