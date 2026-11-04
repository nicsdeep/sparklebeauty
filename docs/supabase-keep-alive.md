# Supabase keep-alive health check (portable guide)

This is a drop-in, read-only health check that stops a **free-tier Supabase project** from being paused for inactivity during development or demo periods. Copy this file into any Supabase + Vercel project and follow the steps. All the code is included.

> **Not a substitute for a paid plan.** Once a project is production-critical, upgrade it. Paid projects are never paused and get backups. This check exists only for free-tier development and demo use.

---

## What it does

```
Vercel Cron (once a day)
  → GET /api/health  with  Authorization: Bearer <CRON_SECRET>
    → supabase.rpc("ping")   // returns the database time: no tables, no writes
      → one log line: started / ok / failed (+ time, duration, short error)
```

- **One tiny read-only query.** `public.ping()` just returns `now()`. It reads no tables and writes nothing.
- **Server-side only.** It runs in a Vercel Function and uses the normal anon/publishable key. It never needs the service-role key.
- **Protected.** The endpoint answers only when the request carries the `CRON_SECRET`. Vercel Cron sends it automatically.
- **No retries.** A failure is logged and the next day's run tries again. There are no loops.
- **Isolated.** It touches no business tables (orders, customers, inventory, payments and so on). Removing it is three deletions (see [Disable or remove](#disable-or-remove)).

## Why it must never write fake business data

A keep-alive that inserts dummy orders, customers or products corrupts the data the business runs on. It skews reports, stock, revenue and loyalty, and it creates records someone could mistake for real ones. All the platform needs is a request, so this check only reads the database clock and **never writes to the database**. Don't "improve" it with inserts.

## Schedule

Once a day, at `0 3 * * *` (03:00 UTC, which is 06:00 in Nairobi). Supabase pauses free projects after about 7 days without activity, so daily runs leave a wide margin. On Vercel's Hobby plan, cron jobs can run at most once a day, and the exact minute can drift within the hour. That's fine for this.

---

## Setup (any Supabase + Next.js App Router project on Vercel)

### 1. Database function: a migration

Create `supabase/migrations/<YYYYMMDDHHMMSS>_health_ping.sql`:

```sql
-- Keep-alive / health check: a tiny read-only function called daily through the API.
-- It reads no tables and writes nothing. Remove with: drop function public.ping();
create or replace function public.ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
```

Apply it the way the project applies migrations, e.g. `supabase db push --linked`.

### 2. Endpoint: `app/api/health/route.ts`

It needs `@supabase/supabase-js` (already present in any Supabase project). Adjust the two environment variable names if your project uses different ones, such as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

```ts
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Keep-alive / health check. Vercel Cron calls this daily with "Authorization: Bearer <CRON_SECRET>".
// One tiny read-only query (public.ping()); no business data, no writes, no retries.

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
  // One line per event; never secrets or data.
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
```

**If the project has a `middleware.ts`** (e.g. a Supabase session refresh), exclude the endpoint so the check makes only its one query. Add `api/health|` at the start of the matcher's negative lookahead:

```ts
export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
```

If the middleware redirects signed-out users to a login page, this exclusion is required. Without it the cron gets a redirect instead of the check.

### 3. Schedule: `vercel.json`

Add a `crons` entry, keeping any keys the file already has:

```json
{
  "crons": [{ "path": "/api/health", "schedule": "0 3 * * *" }]
}
```

Vercel runs cron jobs **only on the production deployment**, not on previews or locally.

### 4. Secret: `CRON_SECRET`

1. Generate a long random value, for example:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In **Vercel → Project → Settings → Environment Variables**, add `CRON_SECRET` with that value for **Production**, then redeploy. Environment variables apply on the next deployment.
3. Add the name only to `.env.example`:
   ```
   # Server-only. Protects /api/health, the daily Supabase keep-alive check.
   # Never prefix with NEXT_PUBLIC_.
   CRON_SECRET=
   ```
4. For local testing, put a value of your own in the git-ignored `.env.local`.

Never prefix it with `NEXT_PUBLIC_`, never commit it, and never share it in chat or tickets. When `CRON_SECRET` is set, Vercel sends `Authorization: Bearer <CRON_SECRET>` with every cron call. Without it, the endpoint refuses every request (503), so the check stays safe but does nothing.

---

## Test it manually

Locally (`npm run dev`), or against production with your own secret:

```bash
curl -i https://YOUR-APP.vercel.app/api/health
```

That should return **401 Unauthorized**, which shows the endpoint is protected.

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.vercel.app/api/health
```

That should return **200** with `{"ok":true,"database_time":"…","ms":…}`.

| Response | Meaning |
| --- | --- |
| `200 ok:true` | The database answered. |
| `401` | Missing or wrong secret. |
| `503 CRON_SECRET is not set` | Add the variable in Vercel and redeploy. |
| `503 Database check failed` | Supabase didn't answer, or `ping()` is missing. Read the log line. |
| `405` | Something other than GET was sent. Only GET is handled. |

In Vercel you can also open **Project → Settings → Cron Jobs → Run** to trigger it, then check **Logs** for `"event":"health_check"`. A healthy run logs:

```json
{"event":"health_check","status":"started","at":"2026-11-04T03:00:00.120Z"}
{"event":"health_check","status":"ok","at":"2026-11-04T03:00:00.410Z","ms":290}
```

## Disable or remove

- **Pause it:** delete the `crons` entry from `vercel.json` and deploy, or remove `CRON_SECRET` in Vercel (every call is then refused).
- **Remove it completely:**
  1. Delete `app/api/health/route.ts`.
  2. Remove the `crons` entry from `vercel.json`.
  3. Remove `api/health|` from the middleware matcher.
  4. Remove `CRON_SECRET` from Vercel and `.env.example`.
  5. Add a migration with `drop function if exists public.ping();`.

## Adapting it

- **Not Next.js?** Any server-side function that Vercel Cron can call works the same way: check the header, call `rpc("ping")`, and log.
- **Not on Vercel?** Use the host's scheduler (e.g. GitHub Actions `schedule:` calling the URL with the secret, or Cloudflare Cron Triggers). Keep it daily, single-attempt, and read-only.
- **A database cron (pg_cron) doesn't replace this.** Supabase looks for outside activity, so a job that runs inside the database may not keep the project awake.
