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

## 2026-10-30: Claude: Admin dashboard to match the mockup, plus create forms for the quick actions
- PR: (this PR, branch `claude/admin-dashboard`)
- Changed:
  - New admin shell `components/admin/shell.tsx`, which replaces `sidebar.tsx`:
    - large nav with pink active pill, an Orders badge (new orders) and an Inventory badge (low or out of stock);
    - the sidebar collapses to icons on desktop and is a drawer on phones;
    - "Need help? Contact support" opens the shop WhatsApp;
    - top bar with search, View Store, an alerts bell and an initials avatar menu (View Store, Settings, Sign out).
    The bell lists real alerts: new orders, out-of-stock items and low items, each linking to its list.
  - `app/admin/layout.tsx` computes the badges and alerts and passes them to the shell.
  - Dashboard (`app/admin/page.tsx`):
    - a header with the "Glow · Slay · Sparkle" art (`public/brand/admin-dashboard-art.jpg`, cut from Nicholas's banner);
    - four KPI cards: today's sales with % change against yesterday, orders to process, customers, low stock;
    - a 14-day sales trend with a KES axis, gridlines and a callout on today;
    - recent orders with initials avatars, items count and an open link;
    - best sellers with product photos, low-stock cards with photos, the online/in-store and retail/wholesale splits, and four quick actions.
    - The AI suggestion cards were removed from the dashboard, as in the mockup. They're still on AI Insights.
  - `components/admin/charts.tsx`: new `KpiCard`. `BarChart` now has an axis, gridlines, a callout and spaced-out date labels, which Reports also uses.
  - New pages: `/admin/customers/new`, `/admin/products/new` and `/admin/promotions/new`, plus "New" buttons on their list pages, and `/admin/search`.
  - New server actions: `createCustomer`, `createProduct` and `createPromotion`. Promotions insert under the existing staff RLS policy, with server-side validation.
  - Migration `20261031120000_admin_create_customer_product.sql`.
- Why: Nicholas asked for 1:1 parity with the approved admin dashboard mockup, and chose to build real create forms behind the New Customer, Add Product and Create Promotion quick actions, instead of linking to lists.
- Tested:
  - The migration, on the live database inside a block that rolled back (afterwards, no functions, products, customers or brands were left):
    - walk-in customer created;
    - duplicate phone in +254 form rejected;
    - bad phone rejected;
    - wholesale customer gets a wholesale account;
    - product with two lengths gets correct prices, stock, reorder levels and one opening-stock movement;
    - wholesale above retail rejected;
    - several options without an option type rejected;
    - colliding automatic SKUs get a suffix (a bug the test found and I fixed);
    - a typed duplicate SKU rejected;
    - a customer account refused for both functions.
  - Local preview, as the demo admin:
    - dashboard at 1536px (no horizontal scroll, table fits), 1024px, 768px and 375px;
    - the bell shows 3 real alerts;
    - the sidebar collapses (256 → 80px);
    - the phone drawer opens;
    - search for "grace" finds orders and the customer;
    - promotion validation works without saving;
    - all 17 admin pages return 200 inside the new shell.
  - `tsc --noEmit` passes.
  - Not tested: submitting the customer and product forms end to end in the UI. They need the migration applied, so check after merge.
- Follow-ups:
  - A product edit form and photo upload.
  - Password set-up for customers added by staff.

## 2026-10-30: Claude: Correction: migrations applied, entry dates, confirmed details
- PR: (this PR, branch `claude/docs-corrections`)
- Changed: `docs/WORKLOG.md` (this entry) and `docs/PROJECT_STATE.md`.
  - Hours are marked as confirmed.
  - The Database heading now says all migrations are applied.
  - The stale "no Facebook URL" known issue now covers only the missing email.
- Why: a cloud session on Nicholas's phone read the docs and couldn't tell these things. Past entries aren't edited (see the top of this file), so this entry corrects them:
  - **Migrations were applied.** Claude ran `supabase db push --linked` right after each merge, with a dry run first, and checked the result on the live database:
    - `20261030210000_kids_collection` (PR #16)
    - `20261030230000_glam_hero_focus` (PR #17)
    - `20261031090000_product_details_and_reviews` (PR #18)
  - **The product page was checked after merge.** On the live site, NIVEA Soft Moisturising Cream shows all four tabs with its seeded details. The review form appeared for the demo customer Grace Achieng, who has a completed order with Bright Glow Serum. No review was posted.
  - **Wrong dates.** The two entries above dated 2026-10-31 were written on 2026-10-30 (Nairobi time). Migration `20261031090000` has a 2026-10-31 timestamp too. It's correct as a sort order, but it isn't the day it was written. Don't rename an applied migration.
  - **Opening hours:** Nicholas confirmed "Open daily 7am–8pm". This is already the live `store_settings.hours`.
- Tested: `store_settings` read from the live database (hours and Facebook set, email empty). Docs only; no code or schema changes.
- Follow-ups: none.

## 2026-10-31: Claude: Balanced "You May Also Like" beside the product tabs
- PR: (this PR, branch `claude/related-compact`)
- Changed:
  - New `ProductMiniCard` in `components/shop/product-card.tsx`: photo, wishlist heart, brand, name, price and a round cart icon.
  - `QuickAdd` gets a `compact` icon mode (`card-actions.tsx`).
  - The product page shows related products as one row of four mini cards.
    - On screens 1280px and wider, they sit beside the tabs, and the tabs card stretches to the same height.
    - Below that, they go under the tabs, full width.
  - Removed the now-unused `ProductGrid columns={2}` option.
- Why: Nicholas pointed out the large white gap under the short tabs card, beside a tall 2×2 grid of full-size cards.
- Tested: local preview at 1400px, 1100px and 375px.
  - At 1400px: tabs and cards are both 300px tall and top-aligned, and each price fits on one line.
  - At 1100px: tabs span the full width, with four cards (254px each) below.
  - At 375px: two cards across, no horizontal overflow.
  - `tsc --noEmit` passes.
- Follow-ups: none.

## 2026-10-31: Claude: Premium product page, product details and customer reviews
- PR: (this PR, branch `claude/product-page`)
- Changed:
  - `app/(shop)/product/[slug]/page.tsx` is rebuilt to match Nicholas's approved mockup:
    - breadcrumb and a Share button;
    - a gallery with the brand/category line, a large name, rating and "100% Original Product";
    - a large pink price with the mint stock badge, quantity, and Add to Cart (primary), with Buy Now and Wishlist (secondary);
    - a details card (size, SKU and so on, plus the brand), three benefit cards, and a combined Delivery / Free Pickup card;
    - tabs (Description, How to Use, Ingredients, Reviews) beside a 2×2 You May Also Like grid. Related products come from the same category, topped up from the parent department.
  - New components:
    - `product-gallery.tsx`: all `image_urls`, thumbnails, previous/next, swipe, dots and a full-screen view;
    - `product-tabs.tsx`: accessible tabs with arrow-key navigation;
    - `review-form.tsx`;
    - `share-button.tsx`: the phone share sheet, or copies the link.
  - `add-to-cart.tsx` is restyled. `ProductGrid` gets `columns={2}`.
  - `lib/catalog.ts`: `Product` gets `images`, `benefits`, `how_to_use` and `ingredients`. New `getReviews()` and `reviewEligibility()`.
  - New `submitReview` server action.
  - Migration `20261031090000_product_details_and_reviews.sql` (see PROJECT_STATE, Database item 14).
- Why: Nicholas asked for a premium product page with no fake, disconnected UI. Every tab and card reads real database fields and is hidden when empty. Reviews are a working feature, limited to verified buyers.
- Tested:
  - On the live database, inside a block that rolled back:
    - all 74 products got details, 15 of them ingredients;
    - a customer with a delivered order posted a review (shown as "Faith W.", count 234 → 235);
    - a second review, and a review of an unbought product, were both rejected with clear messages;
    - afterwards, no columns, table or functions were left behind.
  - `tsc --noEmit` passes.
  - Local preview at 1440px and 375px, using a temporary uncommitted stub for the new columns (the migration isn't applied before merge):
    - the gallery's previous/next and thumbnails work, and arrows and thumbnails are hidden for single-photo products;
    - the tabs switch;
    - 4 related products show;
    - nothing overflows on a phone.
  - Not tested: posting a review through the UI, and the page with the real seeded details. Both need the migration applied; check them after merge.
- Follow-ups:
  - An admin product editor for the new fields.
  - Marvel Junior still has no photo: none found online, and an AI image would misrepresent the pack.

## 2026-10-30: Claude: "Glow · Slay · Sparkle" homepage banner
- PR: (this PR, branch `claude/glam-hero`)
- Changed:
  - `public/brand/hero-banner.jpg` and `hero-banner-1024.jpg` now hold the new artwork. It's the right side of Nicholas's banner design: the woman, the products and the "Glow · Slay · Sparkle" script. The baked-in heading, buttons, trust row, slider arrows and dots were removed, and the left side is the design's plain pink.
  - The original design is saved as `td2/Sparkle Glam Banner (full design).webp`.
  - `image_focus` is now `100% center`: in `lib/hero.ts` (the fallback), and on the live row via migration `20261030230000_glam_hero_focus.sql`.
- Why: Nicholas chose this banner. It's used as layer 1 only, so the heading and buttons stay live UI (clickable, readable on phones, editable in admin), as the two-layer hero requires.
- Tested: in the local preview at 1440px and on a 375px phone width.
  - Desktop shows the full slogan and products.
  - Phone shows the face, slogan and products above the copy.
- Follow-ups:
  - The design's serif heading font and "Trusted by 10,000+ happy customers" row with avatars were not copied. The site keeps the design-system font (Plus Jakarta Sans) and the factual "Loved by 85K followers on Facebook" line. Nicholas to decide.
  - Apply the migration after merge.

## 2026-10-30: Claude: Kids Collection with real Facebook photos
- PR: (this PR, branch `claude/kids-collection`)
- Changed:
  - Migration `20261030210000_kids_collection.sql`:
    - adds `demo_kids_collection()`: Hair → Kids Braids category (`kids-braids`), the Angels brand, and 8 products (Songa Braid, Ballerina, Sasha, Shanilia, Temple Curl, Barbie, Marvel Junior, Tamasha);
    - each product has one variant, retail and wholesale prices (equal, from Nicholas's list), 36 in stock (reorder level 12) and photos;
    - `reset_demo()` now calls it, so the collection survives a demo reset.
  - New `public/products/kids/`: 13 photos from Sparkle's own Facebook posts. Sasha and Barbie are cropped from the Angels poster Sparkle posted.
  - Homepage category row gets a "Kids Braids" tile (`app/(shop)/page.tsx`, now 8 tiles), and `lib/images.ts` adds its category image.
- Why: Nicholas gave the kids prices (retail = wholesale) and approved using Sparkle's Facebook photos.
- Tested:
  - On the live database, inside a block that rolled back: the migration, a second run (still 8 products and 8 variants), then `demo_seed()`, `demo_images()` and `demo_kids_collection()` again. All 8 products came back with the right prices for both tiers, stock and photo counts, under parent `hair`. Afterwards, no category, products, brand or function were left behind.
  - `tsc --noEmit` passes.
  - In the local preview, the homepage Kids Braids tile shows the poster and links to `/shop?category=kids-braids`.
  - Not tested: the product pages, which need the migration applied first.
- Follow-ups:
  - Apply the migration after merge (`supabase db push --linked`).
  - Marvel Junior needs a photo.
  - Product pages could show the extra photos as a gallery.

## 2026-10-30: Claude: Two-layer homepage hero, editable in admin
- PR: (this PR, branch `claude/hero-banner`)
- Changed:
  - New `components/shop/hero.tsx`:
    - Layer 1 is the banner image, used as a background.
    - Layer 2 is the logo, eyebrow, heading with pink accent, paragraph, two buttons, a trust line with stars, and the location note, rendered as UI.
  - New `lib/hero.ts` (`getHeroBanner()`, with a fallback).
  - Migration `20261030190000_hero_banners.sql`.
  - Admin → Settings → Homepage banner form (`hero-form.tsx`, `saveHeroBanner`).
  - The banner artwork from `td2/banner to be used.png` is saved as optimised JPEGs (199 KB and 70 KB, from a 2 MB PNG).
  - The unused Unsplash hero constant was removed.
- Why: Nicholas asked for the hero to be a reusable two-layer component: background artwork with no baked-in text, and real UI content on top, so the banner can be swapped without a redesign.
- Tested:
  - Migration and RLS in a rolled-back block: anon can read but not update; staff can't update; admin can update. The table didn't remain afterwards.
  - `tsc` passes.
  - Local browser at 1440px (text over the artwork, model on the right) and 375px (artwork on top, text below, no overflow, the 1024px image is used).
- Follow-ups:
  - Apply the migration after merge.
  - The trust line uses real Facebook figures, not the mockup's "10,000+ happy customers", which is unverified.

## 2026-10-30: Claude: Switch to Nicholas's SVG logo and favicon
- PR: (this PR, branch `claude/svg-logo`)
- Changed:
  - The logo is now `public/brand/sparkle-logo.svg`, an unchanged copy of `td2/Sparkle_Beauty_Logo.svg`. The trimmed PNG was removed.
  - The favicon is now `app/icon.svg` plus `app/favicon.ico`, unchanged copies of Nicholas's files. `app/icon.png` was removed; `app/apple-icon.png` stays for iPhones.
- Why: Nicholas asked to use his SVG and ICO files.
- Tested:
  - `tsc` passes.
  - Local browser: the header logo renders.
  - `/favicon.ico`, `/icon.svg` and `/brand/sparkle-logo.svg` return 200 and are linked in the page head.
- Follow-ups: none.

## 2026-10-30: Claude: Official logo and favicon
- PR: (this PR, branch `claude/brand-logo`)
- Changed:
  - Nicholas's logo and favicon files are added to `td2/` as source files, along with `admin design.png`.
  - `public/brand/sparkle-logo.png` is the original PNG, trimmed to its coloured edges (dropping a faint grey line and the white margin) and resized from 518 KB to 162 KB.
  - `app/icon.png` and `app/apple-icon.png` were made from the favicon PNG.
  - `components/logo.tsx` now shows the image instead of the text wordmark. Sizes: header 56–76px tall, footer and login 96px, admin sidebar and mobile menu 48px.
  - `--color-logo-blue` was changed to the logo's actual blue.
- Why: Nicholas supplied the official logo; the site had a placeholder wordmark.
- Tested:
  - `tsc` passes.
  - Local browser: the logo loads in the header (legible at 76px) and footer.
  - `/icon.png` and `/apple-icon.png` return 200 and are linked in the page head.
- Follow-ups: none.

## 2026-10-30: Claude: Facebook details, free CBD delivery and social links
- PR: (this PR, branch `claude/social-links`)
- Changed:
  - **Live data, no code (via Admin → Settings, signed in as Sparkle Admin):**
    - added phone "Maureen 0702 388 724"
    - set free-delivery area "CBD"
  - **Code:**
    - migration `20261030170000_social_links.sql` (`facebook_url` and `instagram_url`)
    - Facebook and Instagram fields in Settings
    - links in the footer and on the contact page
- Why: details from the shop's Facebook page:
  - "All deliveries to Nairobi CBD are free"
  - the business numbers include Maureen 0702 388 724
  - the Instagram handle
- Tested:
  - The settings save was confirmed in the database: `delivery_fee` gives 0 for a "Nairobi CBD" address and 300 for Kilimani.
  - The migration ran in a rolled-back block and returned both URLs.
  - `tsc` passes.
- Follow-ups:
  - Kids Collection: needs the Barbie, Marvel Junior and Tamasha prices, plus retail prices.
  - Decide whether to use photos from the shop's Facebook page.
  - Confirm the opening hours (Facebook says "Always open").

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
