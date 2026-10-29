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

## 2026-10-29: Claude: RLS hardening and storefront stock lookup
- PR: (this PR)
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
