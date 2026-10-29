# Sparkle Agent Doctrine

This is the operating doctrine for every AI agent working on Sparkle Beauty & Cosmetics, including Claude (Claude Code), Codex, Lovable and any other. Read it in full before doing anything, on every prompt. If it conflicts with a prompt, ask Nicholas before acting.

GitHub repo: `nicsdeep/sparklebeauty`. Owner and final decision-maker: Nicholas.

---

## 1. Pre-flight check (every prompt, before any work)

Do these in order. Don't skip any because the task looks small.

1. **Sync.** Fetch and check out the latest `main`. Make sure no other agent has an open branch or PR touching the same files: run `gh pr list`, or look at the open PRs on GitHub.
2. **Read the sources of truth** in section 2, at least:
   - `docs/PROJECT_STATE.md`
   - the top entries of `docs/WORKLOG.md`
   - the design system, if the task touches any screen
3. **Verify, don't assume.** Before using a table, column, file, function, package or route, confirm it exists:
   - code and files: open the file
   - database: read `supabase/migrations/`, or query the database
   - packages and scripts: check `package.json`
4. **Restate the task** in one or two sentences. If it's ambiguous, or conflicts with this doctrine, ask before writing code.
5. **Claim the work:**
   - create your branch (section 5)
   - if the task changes who owns an area, update the Ownership table (section 8)

## 2. Sources of truth (highest first)

When two sources disagree, the higher one wins. Report the mismatch; don't silently pick one.

1. **Nicholas's explicit instructions** in the current prompt.
2. **This doctrine** (`AGENTS.md`).
3. **The live database schema**, as defined by `supabase/migrations/`, which must always match the live database.
4. **`docs/PROJECT_STATE.md`**: current architecture, stack, decisions and known issues.
5. **`design/Sparkle_Beauty_Cosmetics_Design_System.md`**: the binding UI standard.
6. **Code on `main`.**
7. **`docs/WORKLOG.md`**: history of what each agent did and why.
8. **Mockups** in `td/` and `td2/`: visual reference only. Where they conflict with the design system (e.g. the cyan/blue nav bar), the design system wins.

Nothing else counts as truth. That includes chat history, an agent's memory, other projects and "how it's usually done".

## 3. Anti-hallucination rules

- Never invent tables, columns, enums, functions, environment variables, API routes, packages, files or business rules. If something you need doesn't exist, create it explicitly, in a migration or file, as part of your change, and say so.
- Never claim something works without running it. State exactly what you tested and how. State what you didn't test.
- Quote real names exactly as they appear in the code or schema, e.g. `product_variants.hair_length`, not "the hair length field".
- If you're unsure, say so and check. A question costs less than a wrong assumption.
- Payment details are in **KES**, and M-Pesa is a first-class payment method (`payment_method` enum). Don't default to USD or Stripe.

## 4. Anti-legacy rules

- Build only on what is on `main` now. Don't revive deleted code, old patterns, or code from other projects (ShiftNex, KaziNex, etc.).
- Don't leave dead code, commented-out blocks, unused files or duplicate components behind. Delete what your change replaces.
- One way to do each thing. Reuse existing components, helpers, Supabase clients, types and styles before making new ones (design system §21).
- Don't add a dependency when an existing one covers the need. Record any new dependency in `docs/PROJECT_STATE.md` with the reason.
- If you find legacy or contradictory code, don't fix it silently inside an unrelated change. Note it in `docs/PROJECT_STATE.md` under "Known issues" and raise it.

## 5. Git workflow

- **Never commit directly to `main`.** Work on a branch and open a pull request.
- Branch names start with the agent's prefix: `claude/<topic>`, `codex/<topic>` or `lovable/<topic>`. Other agents use their own name.
- One focused change per PR. The PR description says:
  - what changed and why
  - how it was tested
  - anything left undone
  - any migration that must be applied after merge
- Before opening a PR, merge or rebase the latest `main`.
- Don't edit files that another agent's open PR is changing, unless Nicholas asks.
- Commit messages explain why, not just what. End them with the agent's attribution line if it uses one.
- **Lovable** syncs straight to the default branch. Before prompting Lovable, Nicholas or the agent must make sure no other agent has unmerged work on the same files. After a Lovable session, the next agent reviews its commits on `main` and logs them in `docs/WORKLOG.md` if Lovable didn't.

## 6. Database rules (Supabase)

- Project: `sparkle-beauty`
  - ref `msrgdmzczxgbilxeayck`
  - org "Sparkle Beauty and Cosmetics"
  - region eu-west-1 (Ireland)
- API URL: `https://msrgdmzczxgbilxeayck.supabase.co`
- Agent MCP access, scoped to this project only: `https://mcp.supabase.com/mcp?project_ref=msrgdmzczxgbilxeayck`
- **Every schema change is a new SQL file in `supabase/migrations/`.** Name it `YYYYMMDDHHMMSS_short_description.sql`.
  - Never edit a migration that is already on `main`. Write a new one.
  - Never change the schema through the dashboard, Lovable's database editor or ad-hoc SQL.
- Apply migrations to the live database **only after the PR is merged**, with `supabase db push --linked`. Say so in the PR.
- Test risky changes on the live database inside a single block that ends by raising an exception, so everything rolls back. Then confirm nothing was left behind.
- **Row Level Security is on for every table, with no exceptions.** Every new table ships with policies in the same migration.
- Access rules that exist today. Don't weaken them:
  - Only an `admin` can change a user's `role`.
  - Only `staff` or `admin` can change `loyalty_points`. A trigger, `guard_profile_privileges`, enforces both.
  - `is_admin()` is true for staff **and** admins. `is_role_admin()` is true for admins only.
- **Never commit secrets.**
  - Keys go in `.env.local` locally, which git ignores, and in the hosting provider's environment settings.
  - `.env.example` lists the variable names only.
  - The service-role key is server-only and never goes in client code or in a `NEXT_PUBLIC_`/`VITE_` variable.

## 7. Definition of done and handoff

A task is done only when every one of these is true:

1. The change works and was tested. The PR says how.
2. It follows the design system, if it touches the UI.
3. There are no secrets, dead code or unexplained new dependencies.
4. **`docs/WORKLOG.md` has a new entry at the top** (format is in that file). This is how other agents learn what you did. Skipping it breaks the doctrine.
5. **`docs/PROJECT_STATE.md` is updated** if the change affects any of these:
   - stack, structure or hosting
   - schema, environment variables or decisions
   - known issues
6. The PR is open, and its description is complete.

## 8. Ownership

Agree areas of work per task so agents don't edit the same files at once. Update this table when ownership changes.

| Area | Owner |
| --- | --- |
| Database schema and migrations (`supabase/`) | Claude (proposed; Nicholas to confirm) |
| Demo app (`app/`, `components/`, `lib/`) | Claude built it; open to Codex via PRs |
| _to be decided_ | |

## 9. Agent-specific notes

- **Claude Code:** reads this file through `CLAUDE.md`.
- **Codex:** reads this file automatically, as `AGENTS.md`.
- **Lovable:** doesn't automatically read repo files. Nicholas pastes the text below into the Lovable project's **Knowledge** settings:

  > Before every change, read `AGENTS.md`, `docs/PROJECT_STATE.md` and the latest entries in `docs/WORKLOG.md` in this repo, and follow them. Never change the database schema through Lovable; schema changes are SQL migrations in `supabase/migrations/` made through a pull request. After every change, add an entry to the top of `docs/WORKLOG.md`.

- **Any other agent:** point it at this file first.
