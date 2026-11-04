# Sparkle Beauty & Cosmetics

Sparkle Beauty & Cosmetics digital commerce and business management platform integrating ecommerce, POS, retail and wholesale sales, inventory, CRM, payments, loyalty, reporting and AI-assisted insights. Built to demonstrate a complete Order-to-Cash workflow with scalable architecture.

- Design standard: [design/Sparkle_Beauty_Cosmetics_Design_System.md](design/Sparkle_Beauty_Cosmetics_Design_System.md)
- Reference mockups: `td/`, `td2/`
- **AI agents (Claude, Codex, Lovable, any other): read [AGENTS.md](AGENTS.md) first, on every task.**
- Current state of the project: [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md)
- What has been done, by which agent: [docs/WORKLOG.md](docs/WORKLOG.md)

## Supabase keep-alive health check

While the Supabase project is on the free tier, a daily Vercel Cron job calls `GET /api/health` at 03:00 UTC (06:00 Nairobi time). The endpoint runs one read-only query, `public.ping()`, which returns the database time, so the project isn't paused for inactivity. It never writes data; it must never create fake orders, customers or products, because those would corrupt real reports and stock.

- **Schedule:** `vercel.json` → `crons`. It runs on the production deployment only.
- **Secret:** `CRON_SECRET` (server-only) in Vercel → Settings → Environment Variables. Without it, every call is refused.
- **Test:** `curl -i -H "Authorization: Bearer $CRON_SECRET" https://sparklebeauty.vercel.app/api/health` should return `200 {"ok":true,…}`; without the header it returns `401`.
- **Disable:** remove the `crons` entry, or remove `CRON_SECRET`.
- **Full guide**, portable to other Supabase projects: [docs/supabase-keep-alive.md](docs/supabase-keep-alive.md).

This is for development and demo use only. Upgrade the Supabase plan once Sparkle is production-critical.
