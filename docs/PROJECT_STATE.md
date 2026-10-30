# Sparkle project state

This is the current truth about the project. Every agent reads it before working (see `AGENTS.md` §1), and updates it in the same PR when its change makes something here out of date.

_Last updated: 2026-10-30 by Claude_

## The shop

The shop's details live in the database table `store_settings` (one row). Admins edit them in **Admin → Settings**; the app reads them with `getStoreSettings()` (`lib/store.ts`). Don't hard-code them.

As of 2026-10-30:
- **Location:** Kware, Pipeline, Nairobi, near Redeemed Gospel Church and King Worship Centre
- **Hours:** open daily, 7:00 am to 8:00 pm (confirmed by Nicholas on 2026-10-30; use this, not Facebook's listing)
- **Phones:** 0799 912 191 (Shop 1), 0797 468 963 (Shop 2), 0719 707 857 (Shop 2), 0702 388 724 (Maureen)
- **WhatsApp:** +254 727 939 626, chosen by Nicholas. A floating chat button shows it on every shop page. The Facebook page's own WhatsApp button uses 0702 388 724.
- **Social:** facebook.com/Sparklebeautyandcosmetics (about 85K followers, 100% recommended from 11 reviews) and instagram.com/sparkle_beautyand
- **Map:** the contact page embeds the shop's own Google Maps listing
- **Sells:** hair extensions, braids, weaves, crochets and general cosmetics, wholesale and retail. Supplies hair from Angels, Darling, Lush, Sista and Olivia (per Facebook).
- **Kids Collection (Angels "Little Angels" kids braids):** in the catalogue under Hair → Kids Braids (`kids-braids`). Prices in KES, retail = wholesale (Nicholas confirmed): Songa Braid 145, Ballerina 150, Shanilia 170, Sasha 185, Temple Curl 195, Marvel Junior 235, Barbie 250, Tamasha 305. Photos are from Sparkle's own Facebook posts, saved in `public/products/kids/`.
- **Not the same business:** "Sparkle Kids Baby Shop" (baby clothes, 0723 554 989) shows up in Facebook searches. It is unrelated.
- **Delivery pricing:** set in Admin → Settings. Currently Nairobi KES 300, rest of Kenya KES 500, free over KES 10,000, and **free to Nairobi CBD** (free-delivery area "CBD"), as the shop's Facebook posts state.

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
| `lib/` | `supabase/server.ts` (server client), plus:<br>• `store.ts`: `getStoreSettings()` reads `store_settings`<br>• `store-types.ts`: settings type, `telHref`, `whatsappHref`, `deliverySummary` (client-safe)<br>• `images.ts`: hero, category and fallback photos, plus `sized()` for Unsplash URLs<br>• `catalog.ts`: products, prices, stock<br>• `sales-data.ts`: orders and stock for reports<br>• `insights.ts`: rule-based AI<br>• `format.ts`: KES, dates, status labels, delivery fee<br>• `cart.tsx`, `checkout-state.ts`: client state<br>• `auth.ts`, `customers.ts` |
| `middleware.ts` | Refreshes the Supabase session cookie |
| `supabase/migrations/` | Database schema history: the only way to change the schema |
| `.env.example` | Names of the environment variables (no values) |
| `.mcp.json` | Supabase MCP server for Claude Code, scoped to this project |

## Brand assets

Nicholas chose the SVG files (2026-10-30). Use them unchanged.
- **Logo:** `public/brand/sparkle-logo.svg`, a copy of `td2/Sparkle_Beauty_Logo.svg`. `components/logo.tsx` shows it in the header, footer, login and admin.
- **Favicon:** `app/icon.svg` (from `td2/Sparkle_Beauty_Favicon.svg`) and `app/favicon.ico` (from `td2/Sparkle_Beauty_Favicon.ico`, 6 sizes).
- **Phone home-screen icon:** `app/apple-icon.png` (180×180, from `td2/Sparkle_Beauty_Favicon.png`). iPhones need a PNG here.
- **Logo colours:** pink `#FB0982`, blue `#16AEF7`. The design token `--color-logo-blue` is `#0aa8f2`.
- **Homepage hero (two layers):**
  - The background artwork is image only: no logo or text baked in. It's `public/brand/hero-banner.jpg` (1880×773) plus `hero-banner-1024.jpg` for phones. Both are cut from the right side of Nicholas's "Glow · Slay · Sparkle" design (`td2/Sparkle Glam Banner (full design).webp`). The baked-in text, buttons, slider arrows and dots were removed, and the left side was replaced with the design's plain pink. The image is anchored to its right edge (`image_focus` `100% center`).
  - The logo, copy, buttons and trust line are rendered on top by `components/shop/hero.tsx`.
  - Both layers come from the `hero_banners` table, edited in Admin → Settings → Homepage banner. To swap the artwork, change the image only.
  - `td2/Sparkle Beauty Pink Glamour Banner.png` is Nicholas's flattened mockup of the intended look. It's a reference only; don't use it as the background.
- **Other originals in `td2/`:** `Sparkle_Beauty_Logo_Original_Clear.png`, `Sparkle_Beauty_Favicon.png`, and the admin design reference `admin design.png`.

## Stack

| Layer | Choice | Status |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router, TypeScript), Tailwind CSS 4, lucide-react icons, Plus Jakarta Sans | Built |
| Auth & data access | `@supabase/ssr` with the signed-in user's session. Business changes go through database functions | Built |
| Database, auth | Supabase project `sparkle-beauty` (ref `msrgdmzczxgbilxeayck`, eu-west-1) | Live, seeded |
| Hosting | Vercel project `lazima-iwork/sparklebeauty`, deployed from this repo's root. `vercel.json` sets the framework to Next.js (the project was created as "Other"); `package.json` `engines` pins Node 24.x | Env vars must be set in Vercel |
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

## Database (as of migration `20261031090000`, all applied to the live database)

Migrations, in order:
1. `20261029000000_baseline_schema.sql`: the schema that existed before migrations were tracked.
2. `20261029120000_protect_profile_role.sql`: stops users granting themselves a role or loyalty points.
3. `20261029200000_rls_hardening_and_stock.sql`: storefront stock lookup, function privileges and rebuilt RLS policies.
4. `20261029210000_order_lifecycle_statuses.sql`: adds `paid`, `packed`, `dispatched` and `delivered` to `order_status`.
5. `20261029210100_o2c_schema_and_functions.sql`: O2C tables, columns and business functions (below).
6. `20261029210200_demo_seed.sql`: `demo_seed()`, `reset_demo()` and the initial seed.
7. `20261030090000_store_address.sql`: redefines `demo_seed()` with the real shop address and updates the store location row.
8. `20261030120000_product_images.sql`: adds `demo_images()`, which sets one photo per product in `products.image_urls`. `reset_demo()` now runs `demo_seed()` then `demo_images()`.
9. `20261030150000_store_settings_and_staff.sql`: adds the `store_settings` table (readable by everyone, editable by admins), `delivery_fee()` (now used by `place_order()`), and the admin user functions.
10. `20261030170000_social_links.sql`: adds `facebook_url` and `instagram_url` to `store_settings`.
11. `20261030190000_hero_banners.sql`: adds the `hero_banners` table (anyone can read active banners; admins can write), seeded with the current banner.
12. `20261030210000_kids_collection.sql`: adds `demo_kids_collection()` (idempotent, not callable from the API), which creates the Kids Braids category, the Angels brand and the 8 kids products with prices, stock and photos. `reset_demo()` now runs `demo_seed()`, `demo_images()`, then `demo_kids_collection()`.
13. `20261030230000_glam_hero_focus.sql`: data only. Anchors the homepage banner image to its right edge for the new artwork.
14. `20261031090000_product_details_and_reviews.sql`:
    - adds `products.benefits` (text[]), `products.how_to_use` and `products.ingredients`;
    - adds the `product_reviews` table: anyone can read, staff can delete, and customers write only through `submit_review()`;
    - adds `submit_review()`, which requires a delivered or completed order containing the product, allows one review per customer, and updates `products.rating` and `review_count`;
    - adds `demo_product_details()`, which fills the details for all 74 demo products. `reset_demo()` now also calls it.

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
| `admin_list_users()` | admin | Work users (staff and admins), with active status and last sign-in |
| `admin_save_staff_user(email, name, phone, role, password)` | admin | Creates a work user with a temporary password, or updates an existing account's role, phone or password. Admins can't remove their own admin role |
| `admin_set_user_active(user_id, active)` | admin | Deactivate (blocks sign-in and ends sessions) or reactivate a user. Not allowed on yourself |
| `delivery_fee(method, delivery, amount)` | anyone | The delivery rule, read from `store_settings`. `deliveryFee()` in `lib/format.ts` mirrors it for the cart estimate |
| `reset_demo()` | admin | Runs `demo_seed()`, `demo_images()`, `demo_kids_collection()` and `demo_product_details()` (none callable from the API) to restore the seeded state |
| `submit_review(product, rating, body)` | customer | Posts a review for a product from a delivered or completed order (one each) and updates the product's rating |
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

- **Product photos are demo stock photography** from Unsplash (free licence), matched to each product's type, not Sparkle's own product shots. Brand-name products (e.g. CeraVe, Fenty) show generic bottles. Replace them with real photos in `products.image_urls` (and the `demo_images()` list). Nicholas OK'd using the shop's Facebook photos; so far only the Kids Collection uses them.
- **Kids Collection gaps:** Marvel Junior has no photo (it shows the category image), because no Sparkle post shows it. Sasha and Barbie use crops of the Angels brand poster that Sparkle posted, not pack shots. Kids products have a single variant (no colour options). No photo of the Angels Marvel Junior pack could be found online either.
- **Product details can't be edited in admin yet.** `benefits`, `how_to_use` and `ingredients` are seeded by `demo_product_details()`; there is no admin product editor. Ingredients are filled only where known (15 products): the key ingredients from the description or the product's known formula, or a perfume's notes. They are not full ingredient lists.
- **Seeded ratings:** `products.rating` and `review_count` for the demo catalogue are demo numbers from `demo_seed()`, not real reviews. Written reviews start empty, and real ones are added on top of these counts.
- **Loyalty points can't be redeemed yet.** They are only earned and displayed.
- **Wholesale prices are public:** `product_prices` is readable by everyone, including wholesale tiers.
- **Work users are created directly in Supabase Auth by a database function:** this keeps the service-role key out of the app. There's no email invite or self-service password reset yet. Admins set a temporary password and share it privately.
- **Unconfirmed contact channels:** no shop email has been confirmed (`store_settings.email` is empty). An admin can add one in Settings. The Facebook and Instagram links are set.
- **Advisor warnings are expected:** Supabase advisors flag the `SECURITY DEFINER` functions callable by signed-in users (and `get_variant_stock` by `anon`). This is intentional; each one checks the caller.
- **Single location:** inventory assumes one location (`main_location_id()`).
