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

## 2026-10-31: Claude: POS cart and payment always in view
- PR: https://github.com/nicsdeep/sparklebeauty/pull/28 (branch `claude/pos-checkout-flow`)
- Changed: `app/admin/pos/terminal.tsx`
  - The cart and payment panel sits beside the products from 1024 px wide (was 1280 px). Below that it is a drawer opened from a bar fixed to the bottom of the screen, which shows the item count, total and a Pay button, plus "Added …" after each Add (or the error, e.g. not enough stock).
  - Product cards show the real stock and a separate "N in cart" tag. Before, the stock number dropped on Add, which looked like stock was being taken before payment.
  - The receipt buttons under Complete are labelled "Reprint/Resend Last Receipt".
- Why: Nicholas reported that tapping Add reduced stock and nothing else happened, with no visible way to pay. On screens under 1280 px the cart was about 12,000 px down, below every product.
- Tested (local preview, live database):
  - At 1024×768 the cart is beside the products. Sale SPK-1066 (3 × Ballerina (Kids), KES 450) was completed with KES 100 cash + KES 350 card; the receipt lists both payments, and stock went from 36 to 33.
  - At 768×1024 the bottom bar shows "Added …" and the total; one tap on Pay opens the cart with the payment options.
  - `tsc --noEmit` passes.
- Follow-ups: none.

## 2026-10-31: Claude: Search as you type, faster pages, one-click buttons
- PR: (this PR, branch `claude/fast-search`)
- Changed:
  - `components/search-suggest.tsx` (new): suggestions while typing in the shop header (desktop and phone menu) and the admin top bar. Keyboard arrows and Enter work; "See all results" opens the results page.
  - `components/live-search.tsx` (new): list pages filter as you type (admin orders, products, customers, inventory, search; shop page).
  - `components/shop/sort-select.tsx` (new): the shop sort applies on pick, replacing the separate Apply button.
  - `components/submit-button.tsx` (new): server-action buttons (sign-in, demo sign-in, sign-out, save preferences, mark notifications read, checkout sign-in) disable themselves and show a spinner, so one click is enough.
  - `app/(shop)/loading.tsx`, `app/admin/loading.tsx` (new): skeleton shown at once on navigation.
  - `vercel.json`: `regions: ["dub1"]`, next to the database.
  - `lib/auth.ts`, `lib/catalog.ts`: `getUser`, `getProfile`, `getCategories` cached per request; shop search matches name, brand and category; the product page loads the product and the user in parallel.
- Why: Nicholas asked for autocomplete in every search bar, buttons that work on the first click, and faster pages. Live timing showed the server running in Washington (`iad1`) while the database is in Ireland, and pages taking 1–4 s.
- Tested:
  - Local preview: typing "bra" in the shop header lists Braids and Kids Braids categories and matching products; "gra" in the admin bar lists Grace's orders and her customer record; typing in the Orders filter narrows the table on each key and keeps focus; the shop sort applies on pick; phone layout checked.
  - `next build` and `tsc --noEmit` pass.
  - Not tested: live page timings after the region change, until this is deployed.
- Follow-ups: measure live timings after deploy.

## 2026-10-31: Claude: Split payments at the POS
- PR: (this PR, branch `claude/split-payments`)
- Changed:
  - Migration `20261101090000_pos_split_payments.sql`: `pos_complete_sale()` takes `p_payments` (list of `{method, amount, phone?, reference?}`) instead of one method, tendered amount and phone. Validates the total, change (cash only), M-Pesa code format and reuse, and offline cash-only. Records one `payments` row per method and returns them.
  - `app/admin/actions.ts`: `completeSale` takes `payments`; new types `PosPayment`, `PosPaymentMethod`, `PosRecordedPayment`.
  - `app/admin/pos/terminal.tsx`: payment panel with up to 5 payments (M-Pesa, cash, card, bank), balance and change, one-tap "pay the balance by" buttons, M-Pesa code entry, receipt listing every payment. The sale panel now scrolls inside itself on short screens so the Complete button is always reachable.
  - Order pages (`app/admin/orders/[id]`, `app/(shop)/order/[number]`) and POS recent sales list all payments of a split sale.
- Why: Nicholas asked that a customer can pay part in cash and the rest by M-Pesa or bank at the till, instead of being sent away to deposit the balance.
- Tested:
  - Live database, in a block that rolled back: cash + M-Pesa code, card + over-tendered cash (change from cash only), cash + bank + M-Pesa, retry returns the same payments, and the errors for short payment, over-charged M-Pesa, reused or malformed M-Pesa code, and offline card. Nothing was left behind.
  - Local preview as the demo cashier: 350 cash on a KES 18,500 sale shows a KES 18,150 balance; one tap on Bank fills it and the button becomes "Complete Sale". `tsc --noEmit` passes.
  - Not tested: completing a split sale from the browser, because the migration is applied only after merge.
- Follow-ups: apply the migration after merge.

## 2026-10-30: Claude: Clean vector logo, and a footer colourway
- PR: (this PR, branch `claude/clean-logo`)
- Changed:
  - `public/brand/sparkle-logo.svg`: replaced the rough straight-line trace with a clean redraw of the original. The mark is traced from `td2/Sparkle_Beauty_Logo_Original_Clear.png` into smooth Bezier curves; the wordmark is Barlow ExtraBold converted to outlines, each letter fitted to its box in the original. Same colours (`#FB0982`, `#16AEF7`) and layout.
  - `public/brand/sparkle-logo-footer.svg` (new): the same logo in rose `#E23D8F` and plum `#5B2150`.
  - `components/logo.tsx`: new `tone` prop (`brand` or `footer`); the shop footer uses `tone="footer"`.
  - Design system §2: the footer colourway is the one approved exception to "original colours".
- Why: Nicholas said the logo looked blurry and asked for a super clean one, with the footer logo in different colours but the same design.
- Tested:
  - Overlaid the new wordmark on the original: letters line up.
  - Rendered the mark at 2× zoom: smooth edges, no jagged corners.
  - Local preview: header and footer load the new files (natural width 1313); both render sharply. `tsc --noEmit` passes.
- Follow-ups: the favicon files were not changed.

## 2026-10-30: Claude: No unrated products in the demo catalogue
- PR: (this PR, branch `claude/kids-ratings`)
- Changed:
  - Migration `20261031200000_kids_demo_ratings.sql`: `demo_ratings()` gives the 8 Kids Collection products demo ratings, the same kind as the rest of the demo catalogue. It runs once now and on every demo reset, and never overwrites real reviews.
  - `components/shop/product-card.tsx`: a product with no reviews shows "New arrival" instead of empty stars and "(0)".
- Why: Nicholas pointed out Ballerina (Kids) showing 0 stars and "(0)". Only the 8 kids products were unrated; the other 66 had demo ratings from `demo_seed()`.
- Tested:
  - On the live database, in a block that rolled back: 0 of 74 products unrated after the migration, and still 0 after a full demo reset. The live database was unchanged afterwards.
  - `tsc --noEmit` passes.
  - Local preview: before the migration, all 8 kids cards show "New arrival" instead of empty stars.
- Follow-ups: none.

## 2026-10-30: Claude: One pricing engine, live POS, real-time sync and offline till
- PR: (this PR, branch `claude/pricing-engine-live-pos`)
- Changed:
  - **Migration `20261031180000_pricing_engine_live_pos.sql`:**
    - pricing engine (`price_breaks`, `price_line`, `price_cart`, `quote_cart`, `pos_quote`, `pos_price_sheet`) and `customer_prices`;
    - `place_order` and `pos_complete_sale` priced by the engine;
    - the `wholesale` channel, `price_rule`, `client_ref` idempotency, and the reserved ≤ quantity check;
    - realtime broadcast triggers and the staff-only `admin` topic policy;
    - wholesale threshold 10.
  - **POS (`app/admin/pos/`) rebuilt to the mockup:**
    - status bar (Online/Offline, live, sync queue) and clock;
    - search and scan, New Sale, Recent Sales, category chips with More;
    - product cards with photo, price, 10+ price and stock;
    - customer picker with pricing banner, cart with rule badges, discount %, totals, payment tiles, Complete Sale, Print and Send receipt (WhatsApp or email);
    - quick actions F2–F7 (scan, manual product by SKU, discount, add customer, park, suspended) and recent products;
    - offline queue with sync and a conflicts panel (`offline-queue.ts`).
    The manual retail/wholesale toggle is gone.
  - **Website:**
    - `lib/cart.tsx` prices lines through `quote_cart` (instant from price breaks, then confirmed) and re-quotes on live stock events;
    - the cart and checkout show the engine prices and rule labels;
    - the product page shows "Buy 10+ and pay KES X each" and switches the price at 10+.
  - **Shared:**
    - `lib/pricing.ts`, `lib/live.ts` and `components/live-refresh.tsx` (mounted in the shop layout and the admin shell);
    - `CHANNEL_META` (Online / POS / Wholesale) for every badge, the orders filter, and 3-way "Sales by channel" on the dashboard and Reports (`SplitBar` now takes parts);
    - the order timeline detects till sales by their first event.
  - **Customer page:** a "Special prices" card for negotiated prices. Wholesale copy updated in Settings and on the Wholesale page.
- Why: Nicholas asked for the POS to be part of one live system with the website and wholesale (one database, one inventory, one pricing engine), automatic wholesale pricing at 10+ units, real-time updates without reloads, and a safe offline till.
- Tested:
  - **On the live database, inside a block that rolled back.** Afterwards, no tables or functions remained and stock was unchanged.
    - **Quotes:** a guest pays 650 for 9 and 500 each for 10 (rule `quantity`). A salon gets its tier price at 1 unit (`customer_tier`). A negotiated 480 holds at 1 and 12 units.
    - **Permissions:** a customer can't call `pos_quote`.
    - **Website order:** 10 Darling braids at 350 (wholesale), channel `online`, 10 reserved.
    - **POS:** a cash sale of 10 NIVEA at 500 with change 1,000. Retrying the same `client_ref` returned `duplicate`: one order, stock 34 → 24 once.
    - **Refusals:** overselling ("Only 24 in stock"), offline M-Pesa refused, an offline cash sale stamps its offline time, the reserved > quantity constraint holds.
  - `tsc --noEmit` passes.
  - **Local preview:**
    - the POS renders to the mockup (80 products, chips, cart, payment tiles);
    - the live status reaches "Live with website" (after fixing duplicate topic joins);
    - simulated offline: only cash, the sale queued with an offline receipt;
    - back online: the sync ran and, before the migration, showed "1 need attention" as designed;
    - all shop and admin pages return 200.
  - **Not tested before merge:**
    - wholesale-account sales, because Postgres can't use a new enum value in the transaction that adds it;
    - the engine prices in the UI;
    - a live cross-tab update.
    All need the migration applied.
- Follow-ups: after merge, test a wholesale-account sale in a rolled-back block, and the 9 → 10 price switch and a cross-tab stock update in the UI.

## 2026-10-30: Claude: Edit products, upload photos, customer sign-in
- PR: (this PR, branch `claude/product-edit-photos-login`)
- Changed:
  - **Edit Product** (`/admin/products/[id]/edit`), with a form shared with Add Product (`app/admin/products/product-form.tsx`, which replaces `new/product-form.tsx`):
    - details, visibility in the shop, featured;
    - photos;
    - options: prices, SKU and reorder level; hide or show; add new options with opening stock. Current stock is shown, linking to Inventory;
    - benefits, how to use and ingredients.
  - The product list links to Edit and shows hidden products. `listProducts({ includeHidden })` and `Product.is_active` are new.
  - **Photo upload:** `components/admin/photo-manager.tsx` uploads several photos from the device, resized to 1600px JPEG in the browser. It also accepts pasted links, reordering (first = main) and removal. Uploads go through `lib/supabase/client.ts`, a new browser client using the existing `@supabase/ssr`. `updateProduct` deletes removed bucket files after a successful save.
  - **Customer sign-in:**
    - "Online access" card on each customer page (`online-access.tsx`): staff set the email and a temporary password;
    - "Change password" card on My Account (`change-password.tsx`, `changePassword` action): checks the current password first.
  - The customer page no longer shows an empty Email link or button for customers without an email.
  - Migration `20261031150000_product_edit_photos_customer_login.sql`.
- Why: Nicholas asked to close the three gaps left by the create forms (no editing, link-only photos, staff-added customers can't sign in) now rather than leave them pending.
- Tested:
  - **On the live database, in blocks that rolled back** (afterwards, no bucket, functions, policies or test customer were left, and Temple Curl was unchanged):
    - editing Temple Curl: renamed, slug unchanged, two photos, price change, a new colour option with 4 in stock and an opening-stock movement;
    - rejected: leaving out an option, hiding all options, a non-http photo link, a duplicate SKU;
    - a staff-set login: email confirmed, the password hash checks out, an email identity is created;
    - refused: a staff account as target, a duplicate email, a short password;
    - storage: the admin can upload, a customer can't;
    - a customer can't edit products or set logins;
    - creating a product with two photos, a single `image_url` (still accepted) and no photo; a bad link rejected.
  - **Bugs the tests caught and I fixed:** the "all options included" check also counted options being added; and saving a single-option product would have wiped its size or colour detail.
  - `tsc --noEmit` passes.
  - **Local preview:**
    - the edit page loads Temple Curl's real data, including 3 photos and 36 in stock;
    - Grace's Online access card shows her email;
    - Change password rejects mismatched passwords and a wrong current password without changing anything.
  - Not tested before merge: uploading to the bucket and saving edits in the UI, which need the migration.
- Follow-ups: an SMTP service for a self-service "forgot password".

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
