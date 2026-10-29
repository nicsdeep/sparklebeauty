# Working agreement: Sparkle Beauty & Cosmetics

This repo is built by Nicholas together with two AI agents, Claude (Claude Code) and Codex.
Both agents read this file. Follow it on every task.

## Design
- `design/Sparkle_Beauty_Cosmetics_Design_System.md` is the binding design standard. Read it before building any screen.
- `td/` and `td2/` hold reference mockups. Where a mockup disagrees with the written design system (e.g. the cyan/blue nav bar in `td2/1.png`), the written design system wins.

## Git workflow
- Never commit directly to `main`. Work on a branch and open a pull request.
- Branch names: `claude/<short-topic>` for Claude, `codex/<short-topic>` for Codex.
- Keep pull requests small and focused on one feature or fix.
- Pull the latest `main` before starting new work; rebase or merge `main` into your branch before opening a PR.
- Don't edit files another agent's open PR is changing unless Nicholas asks.

## Database (Supabase)
- Every schema change is a SQL migration file in `supabase/migrations/`, committed with the PR that needs it.
- Only apply migrations to the shared Supabase project after the PR is merged, and say so in the PR.
- Never commit secrets: keys go in `.env.local` (git-ignored). `.env.example` lists the variable names only.
- Enable Row Level Security on every table that holds customer, order or staff data.

## Ownership
Agree areas of work per task so the two agents don't edit the same files at once. Record the current split here:

| Area | Owner |
| --- | --- |
| _to be decided_ | |
