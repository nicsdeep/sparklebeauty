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

## 2026-10-30: Claude: WhatsApp, admin-editable shop settings and work users
- PR: (this PR, branch `claude/admin-settings`)
- Changed:
  - Migration `20261030150000_store_settings_and_staff.sql`:
    - `store_settings` table, seeded with the current details plus WhatsApp +254 727 939 626
    - `delivery_fee()`, now used by `place_order()`
    - `admin_list_users`, `admin_save_staff_user` and `admin_set_user_active`
  - `lib/store.ts` now reads the database through `getStoreSettings()`, with a fallback. `StoreProvider` passes the settings to client pages.
  - `deliveryFee()` takes the settings. The duplicate `whatsappLink` was removed in favour of `whatsappHref`.
  - WhatsApp now appears in the footer, the contact page (card and button), the home benefits strip, and a floating chat button on every shop page.
  - Admin → Settings has editable forms for shop details, phone numbers (add/remove), WhatsApp, email, map and delivery pricing, including free-delivery areas.
  - A Work users section lets admins add users, edit role, phone or password, and deactivate or reactivate them.
- Why: Nicholas gave the WhatsApp number and asked for such settings, work users and mobile numbers to be manageable in the admin.
- Tested:
  - Migration and functions in a rolled-back block on the live database. The checks covered:
    - delivery fees: pickup 0, Nairobi 300, Mombasa 500, over KES 10,000 free, CBD area free
    - an admin creates, lists and deactivates a staff user and can edit settings
    - an admin can't deactivate themselves
    - staff can't create users or edit settings
    - signed-out visitors can read settings but not change them
  - Confirmed nothing was left behind.
  - `tsc` passes. Contact page checked locally: WhatsApp links go to wa.me/254727939626.
- Follow-ups:
  - Apply the migration after merge.
  - Test the admin forms on the live site after it's applied.

## 2026-10-30: Claude: Premium homepage and product photography
- PR: (this PR, branch `claude/premium-homepage`)
- Changed:
  - Homepage rebuilt:
    - full-bleed hero ("Look good, feel good, be you.", Shop Now / Browse Wigs, model photo)
    - 7 photo category tiles
    - benefits strip: Free Delivery, Secure Payments, Customer Support, Authentic Products, Loyalty Points
    - Featured Products straight after
    - two promotion banners read from `promotions`
    - Special Offers and New Arrivals
  - Product card redesigned:
    - photo, discount or Best Seller badge, wishlist heart, brand, name, star rating, KES price with old price, subtle stock badge
    - pink Add to Cart (single-option products) or Select Options
  - New `lib/images.ts` and `components/shop/card-actions.tsx`. `ProductImage` renders photos with a category fallback.
  - Product images flow through the product page, cart, checkout and account wishlist (`CartItem.image`).
  - New `getWishlistIds()`.
  - Migration `20261030120000_product_images.sql`.
- Why: Nicholas asked for parity with the approved premium homepage concept, with real-looking product images instead of placeholders.
- Tested:
  - All 68 image URLs return 200.
  - `demo_images()` set images on 66 of 66 products in a rolled-back block.
  - `tsc` and `next build` pass.
  - Local browser at 1440px and 375px: no horizontal overflow, 0 broken images; card Add to Cart adds to the cart.
- Follow-ups:
  - Apply the migration after merge.
  - Add the official logo file.
  - Replace demo photos with Sparkle's own.
  - Confirm the WhatsApp number (the benefits strip uses phone support for now).

## 2026-10-30: Claude: Shop map on the contact page
- PR: (this PR, branch `claude/store-map`)
- Changed:
  - `lib/store.ts` gains `mapEmbedUrl` (the Google Maps embed from Nicholas) and `directionsUrl`.
  - The contact page shows the map and a Get Directions button.
- Why: customers need to find the shop in Pipeline.
- Tested: `tsc` passes. On the local contact page the map loads and pins only Sparkle Beauty & Cosmetics. The first embed was a search showing similarly named shops; it was replaced with the shop's own listing before merge.
- Follow-ups: none

## 2026-10-30: Claude: Real shop details
- PR: (this PR, branch `claude/real-store-details`)
- Changed:
  - New `lib/store.ts` holding the shop address, landmark, hours and phones from Nicholas.
  - Replaced the mockup details (Moi Avenue, 0702 388 724, hello@…) in the footer, home, contact, product, checkout pickup, order tracking, POS receipt, admin inventory, order and settings pages, and the site description.
  - Removed the unconfirmed WhatsApp and email.
  - Migration `20261030090000_store_address.sql` redefines `demo_seed()` with the real address.
- Why: the demo showed made-up contact details copied from the mockups.
- Tested:
  - Migration run with `demo_seed()` in a rolled-back block on the live database.
  - `tsc` passes.
  - Checked the contact page, footer (phone links dial 0799912191 etc.) and product pickup text in the local browser.
- Follow-ups:
  - Apply the migration after merge.
  - Confirm the WhatsApp number, email and Facebook URL.
  - Decide whether delivery fees should follow the real "free to Nairobi CBD" rule.

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
