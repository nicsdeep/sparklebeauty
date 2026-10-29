# Sparkle project state

This is the current truth about the project. Every agent reads it before working (see `AGENTS.md` §1), and updates it in the same PR when its change makes something here out of date.

_Last updated: 2026-10-29 by Claude_

## Product

A digital commerce and business management platform for Sparkle Beauty & Cosmetics, in Nairobi, Kenya. It covers:
- ecommerce
- POS
- retail and wholesale pricing
- inventory
- CRM
- payments, including M-Pesa
- loyalty
- reporting
- AI-assisted insights

Currency is KES. The design standard is `design/Sparkle_Beauty_Cosmetics_Design_System.md`.

## Repository layout

| Path | Contents |
| --- | --- |
| `AGENTS.md` | Agent doctrine (read first) |
| `CLAUDE.md` | Points Claude Code to `AGENTS.md` |
| `docs/PROJECT_STATE.md` | This file |
| `docs/WORKLOG.md` | What each agent did and why, newest first |
| `design/` | Written design system |
| `td/`, `td2/` | Reference mockups (visual only) |
| `supabase/config.toml` | Supabase CLI config |
| `supabase/migrations/` | Database schema history, the only way to change the schema |
| `.env.example` | Names of the environment variables (no values) |
| `.mcp.json` | Supabase MCP server for Claude Code, scoped to this project |

**There is no application code yet.** No framework has been chosen and nothing has been scaffolded. The first agent to scaffold the app records the choice under "Stack" and "Decisions".

## Stack

| Layer | Choice | Status |
| --- | --- | --- |
| Database, auth, storage | Supabase project `sparkle-beauty` (ref `msrgdmzczxgbilxeayck`, eu-west-1) | Live |
| Hosting | Vercel | Nicholas reports it's hosted there. Nothing is deployable from this repo yet |
| Frontend framework | _not chosen_ | |
| Payments | M-Pesa, cash, card, bank transfer (enum `payment_method`) | Schema only |

## Environment variables

The names depend on the framework, once chosen. `.env.example` lists them for Next.js:

| Variable | Where | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | No (public; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **Yes**: never in client code |

If the app is Vite (Lovable's default), the public ones become `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`).

## Database (as of migration `20261029200000`)

Migrations, in order:
1. `20261029000000_baseline_schema.sql`: captures the schema that existed before migrations were tracked.
2. `20261029120000_protect_profile_role.sql`: stops users granting themselves a role or loyalty points.
3. `20261029200000_rls_hardening_and_stock.sql`: adds the storefront stock lookup, locks down function privileges and rebuilds the RLS policies. Apply after its PR is merged.

Tables in `public`, all with RLS on:
- **People:** `profiles` (1:1 with `auth.users`; `role` is `app_role`: customer, staff or admin), `customer_addresses`, `customer_notes`, `loyalty_transactions`
- **Catalogue:** `categories` (nested via `parent_id`), `brands`, `products`, `product_variants` (SKU, barcode, shade, hair length/texture/type/style), `pricing_tiers`, `product_prices` (one price per variant per tier, KES)
- **Inventory:** `inventory_locations`, `inventory_levels` (one row per variant per location), `stock_movements`
- **Sales:** `orders` (channel `online` or `pos`), `order_items`, `payments`, `promotions`
- **Wishlist:** `wishlists`, `wishlist_items`

Enums: `app_role`, `order_status`, `payment_method`, `payment_status`, `price_type`, `sales_channel`, `stock_movement_type`.

Functions and triggers:

| Function | What it does |
| --- | --- |
| `handle_new_user()` | Trigger `on_auth_user_created` on `auth.users`; creates a `profiles` row on sign-up |
| `is_admin()` | True for staff or admin |
| `is_role_admin()` | True for admin only |
| `guard_profile_privileges()` | Trigger on `profiles` that protects `role` and `loyalty_points` |
| `rls_auto_enable()` | Event trigger `ensure_rls`; turns RLS on for every new table |
| `get_variant_stock(uuid[])` | Storefront stock lookup. Returns `variant_id`, `quantity_available`, `in_stock` for active variants of active products, summed over active locations. Callable by anyone. Use this instead of reading `inventory_levels`, which is staff-only |

Access rules, after `20261029200000`:
- Signed-out visitors (`anon`) can read active brands, categories, products and variants, all prices, current promotions, and stock via `get_variant_stock`. Nothing else.
- Customers can also read their own profile, addresses, orders, order items, payments and loyalty history. They can edit their own profile (not `role` or `loyalty_points`), addresses and wishlist.
- Staff and admins can read and write everything. Only admins can change roles.
- Policy conventions:
  - one permissive policy per role per action
  - `auth.uid()` and `is_admin()` are wrapped as `(select ...)`
  - staff policies apply `to authenticated` only.

  Follow this pattern for new tables.

Data: 2 rows in `pricing_tiers`, 1 in `inventory_locations`; everything else is empty.

## Decisions

| Date | Decision | By |
| --- | --- | --- |
| 2026-10-29 | `nicsdeep/sparklebeauty` is the single GitHub repo. All work goes through branches and PRs | Nicholas |
| 2026-10-29 | `sparkle-beauty` is the single Supabase project. Schema changes only through migrations | Nicholas |
| 2026-10-29 | The written design system overrides the mockups | Nicholas |

## Known issues

- `product_prices` is readable by everyone, including wholesale and special-tier prices. Decide whether wholesale prices should be hidden from the public storefront.
- Supabase advisors will still flag `get_variant_stock`, `is_admin` and `is_role_admin` as `SECURITY DEFINER` functions callable by signed-in users (and `get_variant_stock` by `anon`). This is intentional: they only return stock figures or the caller's own role.
