# Sparkle project state

This is the current truth about the project. Every agent reads it before working (see `AGENTS.md` §1), and updates it in the same PR when its change makes something here out of date.

_Last updated: 2026-10-30 by Claude_

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

The current build is a **CEO demo of the full Order-to-Cash flow**:
- Payments are simulated; there's no real M-Pesa or card integration.
- Demo data can be reset from Admin → Settings.

## Repository layout

| Path | Contents |
| --- | --- |
| `AGENTS.md` | Agent doctrine (read first) |
| `CLAUDE.md` | Points Claude Code to `AGENTS.md` |
| `docs/PROJECT_STATE.md` | This file |
| `docs/WORKLOG.md` | What each agent did and why, newest first |
| `design/` | Written design system |
| `td/`, `td2/` | Reference mockups (visual only) |
| `app/(shop)/` | Customer website:<br>• home, shop, product and cart pages<br>• `checkout/` (5-step wizard)<br>• `order/[number]` (tracking)<br>• `account/`<br>• `contact/`<br>• `actions.ts` (server actions) |
| `app/admin/` | Admin:<br>• dashboard<br>• orders, POS (`pos/terminal.tsx`)<br>• products, categories, inventory<br>• customers (CRM)<br>• retail, wholesale, promotions, loyalty<br>• reports, insights, settings (demo reset)<br>• `actions.ts` |
| `app/login/` | Sign-in page with one-click demo accounts; `actions.ts` (sign in/out) |
| `components/` | Shared UI:<br>• `ui.tsx`: buttons, badges, cards, `AiCard`<br>• `shop/`, `admin/`<br>• `order-timeline.tsx` |
| `lib/` | `supabase/server.ts` (server client), plus:<br>• `catalog.ts`: products, prices, stock<br>• `sales-data.ts`: orders and stock for reports<br>• `insights.ts`: rule-based AI<br>• `format.ts`: KES, dates, status labels, delivery fee<br>• `cart.tsx`, `checkout-state.ts`: client state<br>• `auth.ts`, `customers.ts` |
| `middleware.ts` | Refreshes the Supabase session cookie |
| `supabase/migrations/` | Database schema history: the only way to change the schema |
| `.env.example` | Names of the environment variables (no values) |
| `.mcp.json` | Supabase MCP server for Claude Code, scoped to this project |

## Stack

| Layer | Choice | Status |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router, TypeScript), Tailwind CSS 4, lucide-react icons, Plus Jakarta Sans | Built |
| Auth & data access | `@supabase/ssr` with the signed-in user's session. Business changes go through database functions | Built |
| Database, auth | Supabase project `sparkle-beauty` (ref `msrgdmzczxgbilxeayck`, eu-west-1) | Live, seeded |
| Hosting | Vercel (deploy from this repo's root; no extra config) | Env vars must be set in Vercel |
| Payments | Simulated M-Pesa (STK-push style prompt), card and cash | Demo only |
| Node | 24 LTS locally | |

No chart library: charts are simple components in `components/admin/charts.tsx`.

## Environment variables

Set these in `.env.local` locally and in Vercel → Settings → Environment Variables:

| Variable | Where | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server (the project's publishable key) | No: RLS and the database functions protect data |
| `DEMO_PASSWORD` | server only | **Yes**: shared password of the demo accounts, used by the one-click demo sign-in. Never prefix with `NEXT_PUBLIC_` |

The app does **not** use the Supabase service-role key.

## Demo accounts

| Account | Email | Use |
| --- | --- | --- |
| Grace Achieng (customer) | `grace.achieng@example.com` | Storefront, checkout, account |
| Sparkle Admin (admin) | `admin@sparkle.example` | Everything, including demo reset |
| Esther Wanjiku (staff) | `staff@sparkle.example` | Admin and POS; can't reset the demo |

Passwords are set outside the repo to the `DEMO_PASSWORD` value. Other seeded customers have no password and can't sign in.

## Database (as of migration `20261029210200`)

Migrations, in order:
1. `20261029000000_baseline_schema.sql`: the schema that existed before migrations were tracked.
2. `20261029120000_protect_profile_role.sql`: stops users granting themselves a role or loyalty points.
3. `20261029200000_rls_hardening_and_stock.sql`: storefront stock lookup, function privileges and rebuilt RLS policies.
4. `20261029210000_order_lifecycle_statuses.sql`: adds `paid`, `packed`, `dispatched` and `delivered` to `order_status`.
5. `20261029210100_o2c_schema_and_functions.sql`: O2C tables, columns and business functions (below).
6. `20261029210200_demo_seed.sql`: `demo_seed()`, `reset_demo()` and the initial seed.

Tables in `public`, all with RLS on:
- **People:**
  - `profiles`: 1:1 with `auth.users`; `role` is `app_role` (customer, staff or admin); also stores email, date of birth and notification preferences.
  - `customer_addresses`, `customer_notes`, `loyalty_transactions`
  - `wholesale_accounts`: business name and price tier per wholesale customer.
  - `notifications`: per customer, written by the order functions.
- **Catalogue:**
  - `categories`: nested via `parent_id`. The "Hair" parent holds Wigs, Hair Pieces, Braids, Extensions and Hair Care.
  - `brands`, `products`
  - `product_variants`: SKU, barcode, length, colour, shade, size, texture.
  - `pricing_tiers`: retail, and wholesale with a minimum of 6 items.
  - `product_prices`: one price per variant per tier, in KES.
- **Inventory:**
  - `inventory_locations`: one store, "Main Store".
  - `inventory_levels`: `quantity` on hand, `reserved` for open online orders; available = quantity − reserved; `reorder_level` drives "Low Stock".
  - `stock_movements`
- **Sales:**
  - `orders`: channel `online` or `pos`; holds a customer contact snapshot, `delivery_method`, `promotion_id` and `created_by`.
  - `order_items`, `payments`, `promotions`
  - `order_events`: the status timeline.
- **Other:** `wishlists`, `wishlist_items`, and `activity_log` (staff actions, demo resets).

**Order lifecycle:** `pending` (shown as "New") → `confirmed` → `paid` → `processing` → `packed` → `dispatched` → `delivered` → `completed`, or `cancelled`.
- Placing an online order **reserves** stock.
- **Dispatch** deducts it.
- **Cancel** releases it.
- **Completed** retail orders earn 1 loyalty point per KES 100.
- **POS sales** are created as `completed` and deduct stock immediately.

Business functions. All are `SECURITY DEFINER` and validate the caller and their input; the app calls them with the user's session:

| Function | Who | What it does |
| --- | --- | --- |
| `place_order(items, contact, delivery, payment_method, promo_code)` | signed-in customer | Re-prices from `product_prices`, checks and reserves stock, applies the promo, works out delivery, and creates the order, items, pending payment, event and notification |
| `pay_order(order_id, phone)` | order's customer | Simulated M-Pesa/card success: marks the payment paid with a reference |
| `advance_order(order_id, note)` | staff | Moves the order one lifecycle step. Handles payment confirmation, stock deduction on dispatch and loyalty on completion |
| `cancel_order(order_id, reason)` | staff | Cancels before dispatch and releases stock |
| `pos_complete_sale(customer, tier, items, discount, method, tendered, phone)` | staff | In-store sale: retail or wholesale (needs a wholesale customer and at least 6 items). Deducts stock and records payment and loyalty |
| `adjust_stock(variant_id, delta, reason)` | staff | Receive stock or correct counts |
| `reset_demo()` | admin | Runs `demo_seed()` (not callable from the API) to restore the seeded state |
| `get_variant_stock(uuid[])` | anyone | Storefront availability (`quantity_available`, `in_stock`, `low_stock`) |
| `is_admin()` / `is_role_admin()` | signed-in | Staff-or-admin / admin-only checks used by policies |

Other triggers: `handle_new_user` (creates the profile, with email), `guard_profile_privileges` (protects `role` and `loyalty_points`), and the event trigger `ensure_rls`.

Policy conventions:
- one permissive policy per role per action
- `auth.uid()` and `is_admin()` are wrapped as `(select ...)`
- staff policies apply `to authenticated`.

Follow this pattern for new tables.

Gotcha: Supabase blocks `DELETE`/`UPDATE` without a `WHERE` clause in API requests. Bulk statements inside functions need `where true`.

**Seed:**
- **Catalogue:** 66 products (124 variants).
- **Customers:** 20 retail customers including Grace Achieng, and 3 wholesale salons.
- **Orders:** 30 orders over 30 days: mixed channels, statuses and payment methods, plus Grace's history.
- **Promotions:** `SPARKLE10` (10% over KES 3,000), `WIGWEEK` (KES 1,500 off over KES 15,000), and one expired.
- **Stock:** demo situations include Bright Glow Serum at 6 units (about 1 sold a day, reorder level 5), plus several low-stock and two out-of-stock items.

The seed uses fixed IDs and a fixed random seed. The newest seeded orders are timed relative to when the seed runs, so **reset just before a demo** to make "today" look right.

## Decisions

| Date | Decision | By |
| --- | --- | --- |
| 2026-10-29 | `nicsdeep/sparklebeauty` is the single GitHub repo. All work goes through branches and PRs | Nicholas |
| 2026-10-29 | `sparkle-beauty` is the single Supabase project. Schema changes only through migrations | Nicholas |
| 2026-10-29 | The written design system overrides the mockups | Nicholas |
| 2026-10-29 | Stack: Next.js 15 + Supabase on Vercel. Money and stock changes only through database functions; no service-role key in the app | Claude, for the CEO demo |
| 2026-10-29 | The O2C demo migrations were applied to the live database before their PR merged, to build and test the demo in time. The database held no real data | Nicholas approved |

## Known issues

- **Brand assets missing:**
  - No official logo file in the repo. `components/logo.tsx` shows a text wordmark until the real logo is added to `public/brand/`.
  - No product photos. `ProductImage` shows branded placeholders; `products.image_urls` is still empty.
- **Loyalty points can't be redeemed yet.** They are only earned and displayed.
- **Wholesale prices are public:** `product_prices` is readable by everyone, including wholesale tiers.
- **Shop contact details are from the mockups.** The phone number 0702 388 724 and email hello@sparklebeauty.co.ke need confirming.
- **Advisor warnings are expected:** Supabase advisors flag the `SECURITY DEFINER` functions callable by signed-in users (and `get_variant_stock` by `anon`). This is intentional; each one checks the caller.
- **Single location:** inventory assumes one location (`main_location_id()`).
