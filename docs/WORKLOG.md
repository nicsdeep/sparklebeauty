# Sparkle work log

Every agent adds an entry **at the top** when it finishes a task, as part of the same PR (see `AGENTS.md` §7). This is how Claude, Codex, Lovable and any other agent know what the others did. Never edit or delete past entries; if one was wrong, add a new entry correcting it.

Entry format:

```
## YYYY-MM-DD: <agent>: <short title>
- PR: <link or "none">
- Changed: <files / tables / screens>
- Why: <reason>
- Tested: <how, or "not tested">
- Follow-ups: <anything left undone, or "none">
```

---

## 2026-10-30: Claude: Fix Vercel deployment config
- PR: (this PR, branch `claude/vercel-config`)
- Changed:
  - Added `vercel.json` with `"framework": "nextjs"`.
  - Added `"engines": { "node": "24.x" }` to `package.json`.
- Why: the Vercel project `lazima-iwork/sparklebeauty` was created with Framework Preset "Other". The Next.js build succeeded, but Vercel then failed with `STATIC_BUILD_NO_OUT_DIR` because it looked for a `public` output folder. Vercel also defaulted to Node 26, while the app is built and tested on 24.
- Tested: read the failed deployment log with `vercel inspect --logs`. The Vercel build itself is untested until this merges.
- Follow-ups: Nicholas to add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `DEMO_PASSWORD` in Vercel. None are set yet.

## 2026-10-30: Claude: Connected O2C demo (storefront, checkout, admin, POS, CRM, insights)
- PR: (this PR, branch `claude/o2c-demo`)
- Changed:
  - Next.js 15 app at the repo root: `app/`, `components/`, `lib/`, `middleware.ts`.
  - Migrations `20261029210000` (order statuses), `20261029210100` (O2C schema and business functions) and `20261029210200` (demo seed and reset).
  - `.env.example` now lists `DEMO_PASSWORD` instead of the service-role key.
- Why: CEO demo of one connected Order-to-Cash system: ecommerce, cart, checkout, simulated payment, admin order processing, inventory, CRM, POS (retail and wholesale), loyalty, reports and AI insights, all on one database.
- Tested: in the browser against the live database.
  - Customer: home → wig with 18" selected → serum → cart with SPARKLE10 → checkout, signed out then demo sign-in → details pre-filled → delivery → Back/Next keeps the delivery note → M-Pesa prompt → simulated payment → confirmation and tracking page.
  - Admin: the same order through all 8 lifecycle steps. Bright Glow Serum went 6 → reserved → 5 on hand at dispatch, and Grace earned +225 points, shown in the CRM.
  - POS: wholesale cash sale to Mama Pendo Salon, with SKU entry, the 6-item minimum, change and receipt.
  - Every admin page renders. Demo reset works from Settings.
  - Anonymous API calls to the protected functions and tables are refused.
  - `tsc` and `next build` pass.
- Follow-ups:
  - The migrations were applied to the live database **before** merge, with Nicholas's approval (the database had no real data).
  - Set the Vercel environment variables.
  - Add the official logo and product photos.
  - Loyalty redemption isn't built.
  - Reset the demo just before presenting.

## 2026-10-29: Claude: RLS hardening and storefront stock lookup
- PR: https://github.com/nicsdeep/sparklebeauty/pull/5
- Changed:
  - Migration `20261029200000_rls_hardening_and_stock.sql`.
  - New `get_variant_stock(uuid[])`.
  - Revoked function privileges from `anon` (and from everyone for the trigger functions).
  - Rebuilt all 32 RLS policies.
- Why: fix the three known issues from the baseline review:
  - customers couldn't see stock
  - `SECURITY DEFINER` functions were callable by anyone
  - RLS performance warnings
- Tested: 31 access cases (signed out, customer, other customer, staff, admin) on the live database in a rolled-back block. All 31 passed, and nothing was left behind.
- Follow-ups:
  - Apply with `supabase db push --linked` after merge.
  - Decide whether wholesale prices should be public.

## 2026-10-29: Claude: Agent doctrine, project state and work log
- PR: (this PR)
- Changed:
  - Rewrote `AGENTS.md` as the agent doctrine.
  - Added `docs/PROJECT_STATE.md` and `docs/WORKLOG.md`.
- Why: give every agent (Claude, Codex, Lovable and others) one shared set of rules and one record of the project's current state and history.
- Tested: n/a (docs only)
- Follow-ups:
  - Nicholas to paste the Lovable instruction from `AGENTS.md` §9 into Lovable Knowledge.
  - Nicholas to confirm the Ownership table.

## 2026-10-29: Claude: Stop users granting themselves a role or loyalty points
- PR: https://github.com/nicsdeep/sparklebeauty/pull/2
- Changed:
  - Migration `20261029120000_protect_profile_role.sql`.
  - New `is_role_admin()` and trigger `guard_profile_privileges` on `profiles`.
- Why: the "customer update own profile" policy let customers change their own `role` (to admin) and `loyalty_points`, and staff could promote themselves.
- Tested: 7 permission cases on the live database in a rolled-back block. All behaved as expected. Applied with `supabase db push --linked` after merge.
- Follow-ups: none

## 2026-10-29: Claude: Baseline migration for the existing schema
- PR: https://github.com/nicsdeep/sparklebeauty/pull/1
- Changed: migration `20261029000000_baseline_schema.sql`, which records the 19 tables, 7 enums, 32 policies, 3 functions and the sign-up trigger.
- Why: the database had been built without migrations, so the repo didn't match it.
- Tested: generated from the live catalog. Marked as applied with `supabase migration repair`, not re-run.
- Follow-ups: three issues logged under "Known issues" in `docs/PROJECT_STATE.md`.

## 2026-10-29: Claude: Project setup
- PR: none (initial setup commits on `main`)
- Changed:
  - Repo moved to `nicsdeep/sparklebeauty`, with the design system and mockups.
  - `.gitignore`, `.env.example`, `.mcp.json`, and the `supabase/` CLI config, linked to `sparkle-beauty`.
- Why: shared starting point for all agents.
- Tested: pushed to GitHub. Supabase CLI login and link verified.
- Follow-ups: none
