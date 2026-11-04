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

## 2026-11-03: Claude: CRON_SECRET set in Vercel; keep-alive switched on
- PR: (this PR, branch `claude/keep-alive-enabled`)
- Changed:
  - `CRON_SECRET` was added in Vercel → sparklebeauty → Environment Variables. It is a Secret type, for Production only, with a note pointing to `docs/supabase-keep-alive.md`.
  - Claude filled in the name, note, type and environment. Nicholas generated and pasted the value, so it was never typed by an agent or shown in chat.
  - This entry's merge triggers the production deploy that picks up the variable. Vercel's own "Redeploy" button asks for an emailed re-authentication code, which is left to Nicholas.
- Why: the daily `/api/health` check (PR #63) refuses every call until the secret exists.
- Tested: see the PR. After the deploy, production returns 401 for calls without the secret (it was 503 "not set" before), and the cron job is listed in Vercel.
- Follow-ups: none.

## 2026-11-03: Claude: Supabase keep-alive health check
- PR: (this PR, branch `claude/supabase-keep-alive`)
- Changed:
  - Migration `20261108090000_health_ping.sql` adds `public.ping()`.
  - `app/api/health/route.ts`:
    - GET only, checked against `CRON_SECRET` with `timingSafeEqual`;
    - one `rpc("ping")` with the anon key and no retries;
    - one JSON log line per event (started, ok, failed, unauthorized, not_configured).
  - `vercel.json` cron `0 3 * * *`.
  - `middleware.ts` skips `/api/health`.
  - `CRON_SECRET` added to `.env.example`.
  - A README section, and the portable guide `docs/supabase-keep-alive.md`, which has all the code inline so Nicholas can reuse it in other Supabase projects.
- Why: keep the free-tier project from pausing during development and demos, without fake data or load.
- Tested:
  - locally: no header → 401, wrong secret → 401, POST → 405, right secret → 503 before the migration (the log shows "Could not find the function public.ping"), and the log lines contain no secrets;
  - the migration in a rolled-back batch, calling `ping()` as the anon role;
  - lint and typecheck.
  - After merge: production returns 401 without the secret. The 200 run needs `CRON_SECRET` set in Vercel.
- Follow-ups: Nicholas adds `CRON_SECRET` in Vercel (Production) and redeploys.

## 2026-11-03: Claude: ESLint and database performance checks
- PR: (this PR, branch `claude/eslint-db-checks`)
- Changed:
  - Added ESLint 9 with the Next.js config (`eslint.config.mjs`, `npm run lint`). It reported 9 issues, now fixed:
    - 2 unescaped apostrophes;
    - 4 unused imports;
    - `aria-invalid` on the Combobox button, replaced with `aria-describedby` pointing at the error;
    - the anonymous default export in `postcss.config.mjs`;
    - an intentional rest-sibling omit (rule set to `ignoreRestSiblings`).
  - Ran the database performance checks in SQL: unindexed foreign keys, RLS init-plan, multiple permissive policies and duplicate indexes. The one finding was `announcements.updated_by`, now indexed by migration `20261107120000_announcements_updated_by_index.sql`.
- Why: Nicholas asked for both checks to be added.
- Tested:
  - `eslint . --max-warnings 0` and `tsc --noEmit` pass;
  - the migration in a rolled-back batch;
  - lock file: no existing package version changed, and 292 dev packages were added.
- Follow-ups: the 2 production `npm audit` advisories in Next.js's dependencies wait for a Next.js upgrade.

## 2026-11-03: Claude: Rotating announcement bar and a clearer header logo
- PR: (this PR, branch `claude/announcement-bar`)
- Changed:
  - `components/shop/announcement-bar.tsx` replaces the static "Free delivery … · Pay with M-Pesa, card or cash on delivery" strip:
    - one message at a time, changing every 4.5 s with a soft fade and a 6 px rise;
    - it pauses on hover or focus and while the tab is hidden;
    - dots let the customer pick a message (desktop);
    - with `prefers-reduced-motion`, messages change without movement;
    - 40 px tall on desktop and 36 px on phones, always one line, using the shorter phone wording.
  - Messages are data (migration `20261107090000_announcements.sql`, `lib/announcements.ts`), edited in Admin → Settings (`announcements-form.tsx`, `saveAnnouncements`). Seeded with:
    - free delivery over {free_threshold}, linking to /delivery;
    - original products from trusted brands;
    - fast delivery across Kenya, linking to /delivery;
    - track your order, linking to /account#orders.
  - Payment wording moved out of the top bar. Checkout now says "Secure checkout · M-Pesa · Card · Cash on delivery"; the footer already shows "We accept".
  - Header logo: the same full-colour file as the footer, drawn larger (64 px on phones, 84 px on desktop; was 56 / 76). The header padding is trimmed so the phone header stays 81 px. The admin sidebar logo uses the same size.
- Why: Nicholas asked for a trust-first, calm announcement bar, and for the header logo to look as clear as the footer one.
- Tested in the browser:
  - 1366 px and 375 px: the messages rotate, each phone message fits on one line, no overflow;
  - pause on hover, the dots, the links;
  - the checkout line;
  - the migration in a rolled-back batch (seed rows, and the icon check rejects unknown icons).
  - Not tested in the browser: the reduced-motion path (it can't be emulated in the test browser). It is covered by CSS `motion-reduce` and a `matchMedia` check.
- Follow-ups: none.

## 2026-11-03: Claude: Mobile-first Shop page
- PR: (this PR, branch `claude/mobile-shop-page`)
- Changed:
  - `app/(shop)/shop/page.tsx` is a product-discovery workspace with no hero. In order:
    - "All Products" and the live count;
    - a large search;
    - quick category tiles that scroll sideways, plus More (a sheet);
    - Shop by Brands (featured brands plus See All, a searchable sheet);
    - Filter and Sort;
    - products, 2 columns on phones, 3 on tablet, 4 on wide desktop;
    - pages of 20.
  - Filters:
    - `lib/shop-filters.ts` filters by category, brand, colour/shade, length, size, price, in stock and on offer;
    - filter values come from the products and depend on each other (doctrine §24, §25);
    - `components/shop/shop-controls.tsx` shows the filter panel in a bottom sheet below `lg` and in a sidebar on desktop; long lists use the shared Combobox;
    - active filters show as chips with Clear all, and everything is in the URL.
  - New shared `components/sheet.tsx`: a bottom sheet on phones and a right-hand drawer from `md`.
  - Product cards (`components/shop/product-card.tsx`, used site-wide):
    - white, with a discount, Bestseller or New badge, the heart, name, brand, pink price with the old price, and a cart button;
    - a product with options opens a variant picker sheet instead of guessing a SKU; with Shop filters set, it preselects the matching option.
  - `components/search-suggest.tsx`:
    - the shop index adds brands and SKUs and lists only active products;
    - `live` mode filters the grid as you type;
    - Escape no longer clears the box.
  - Header: a search icon on phones. The bottom bar shows a cart count badge and highlights Shop.
  - `Pagination` gains `anchor`, so shop page links jump to the grid.
  - Removed `components/shop/sort-select.tsx`, replaced by `SortMenu`.
  - Migration `20261106090000_brands_featured_rank.sql`.
- Why: Nicholas asked for a modern mobile Shop page that reaches products straight away.
- Tested in the browser:
  - 375, 390, 430, 768, 1024 and 1440 px: no horizontal overflow; 2, 2, 2, 3, 3 (sidebar) and 3 columns, the last now 4 from 1280 px;
  - live search ("wig" → 10 products, no Enter) and SKU search;
  - dependent filters (Wigs offers only wig colours and lengths);
  - quick taps on colour then length keep both;
  - chips;
  - the variant picker adds the exact variant;
  - search → filter → page 2 → scroll → product → Back restores sort, filters, page and scroll (1300 px);
  - the migration in a rolled-back batch.
- Follow-ups:
  - an admin control for featured brands;
  - move catalogue filtering into the database when it grows.

## 2026-11-03: Claude: Storefront footer revamp and policy pages
- PR: (this PR, branch `claude/footer-revamp`)
- Changed:
  - `components/shop/footer.tsx` replaces the inline footer in `app/(shop)/layout.tsx`:
    - a white-to-pink gradient with light waves and line-art cosmetics bottom-left;
    - the full-colour logo (`tone="brand"`), the tagline, and icon-only social links;
    - five columns on desktop (Brand, Shop, Customer Care, Policies, Get in Touch), three on tablet, accordions on mobile;
    - one WhatsApp action (the main WhatsApp contact, shown as +254), instead of every phone number;
    - a bottom bar with the copyright and "We accept": M-PESA, Visa, Mastercard and Cash, the methods checkout offers.
  - New pages, sharing `components/shop/policy-page.tsx`:
    - `/delivery`, `/shipping-policy`, `/returns`, `/terms`, `/privacy`, `/cookies` and `/faqs`;
    - the shared layout has the updated date, a help and policies menu, and a `ToConfirm` tag for terms Sparkle hasn't confirmed;
    - fees, free-delivery rules, the address and hours come from `store_settings`.
  - `components/shop/shop-back-link.tsx`: `ShopTrail` (in the shop layout) and `ShopBackLink`. Back returns to the shop page the customer came from, or home.
  - Migration `20261105120000_social_tiktok_youtube.sql` adds `store_settings.tiktok_url` and `youtube_url`, with Settings fields and https:// validation.
  - The WhatsApp logo moved to `components/shop/social-icons.tsx` so the footer and the chat button share it.
- Why: Nicholas asked for a softer, more complete footer with working policy links.
- Tested:
  - typecheck;
  - in the browser at 1366 px, 779 px and 375 px: every footer link, the mobile accordions, and no horizontal scroll;
  - all seven pages and the perfumes and accessories categories return 200;
  - Back from `/terms` returns to `/shop?category=perfumes`.
- Follow-ups:
  - Sparkle to confirm the tagged policy terms;
  - add the TikTok and YouTube links in Settings.

## 2026-11-04: Claude: Two-part product options and barcodes
- PR: (this PR, branch `claude/combo-options-barcode`)
- Changed:
  - Migration `20261105090000_product_combo_options_barcode.sql` redefines `admin_update_product()` and `admin_create_product()`:
    - option types `colour_length` and `colour_size`: rows carry `option` (the colour) and `option2` (the length or size), and the variant name is "Colour · Length";
    - an optional `barcode` per variant, checked as unique;
    - **fix:** editing no longer clears the attributes the option type doesn't use. Before, saving a seeded wig by length wiped its colour; 41 variants have both a colour and a length.
  - `app/admin/products/product-form.tsx`:
    - "Colour + Length" and "Colour + Size" option types, each row with a searchable Colour and Length/Size, using catalogue values or new ones;
    - a Barcode column with validation (4–32 letters or digits);
    - Pricing shows the SKU and barcode;
    - the preview and labels show "Colour · Length".
  - Edit page: loads barcodes and recognises two-part options (name = "colour · length").
  - `ProductInput` gains `option2` and `barcode`.
- Why: Nicholas asked for Colour + Length combinations and barcodes, after the product workspace PR.
- Tested:
  - **Migration, on the live database in one batch that rolled back** (checked afterwards: no test products left):
    - a Colour + Length product saved its variants as "Brown · 18"" (color Brown, length 18", barcode ZZTEST0001) and "Black · 22"";
    - saving Body Wave Lace Front Wig by length kept "Natural Black" on all 3 variants;
    - a duplicate barcode was refused.
  - **Form, in the local preview:** Colour + Length shows Colour and Length columns, with lengths from the catalogue (10"–24"). Body Wave's edit page loads its barcodes. `tsc --noEmit` passes.
  - **Not tested yet:** saving from the form with the new types (it needs the migration applied after merge).
- Follow-ups: apply the migration after merge.

## 2026-11-04: Claude: Products list redesign
- PR: (this PR, branch `claude/products-list`)
- Changed:
  - `app/admin/products/page.tsx`, rebuilt to Nicholas's design:
    - the header with icon, count and KES note, and Add Product;
    - **summary cards** (Total, Low Stock, Out of Stock, Featured) that open the list with that filter. Each card's note is real (e.g. "20 added in the last 30 days"); no trend lines are invented, because there's no stock history to draw them from;
    - **search** by name, brand, category or SKU;
    - a **Filter** panel opened in place: Category, Brand/Supplier, Stock and Shop (featured / hidden / visible), all searchable comboboxes, with removable chips and Clear all;
    - **Sort**: featured first, name, price both ways, lowest stock, newest;
    - **Export CSV**: one row per SKU, using the same filters;
    - a table with photo, name, brand, Featured and Hidden, category, options, retail and wholesale ranges, available stock, status, and Edit plus a ⋯ menu (View in shop, Stock in Inventory);
    - **pagination**, 20 per page.
  - `app/admin/products/list-data.ts`: shared filtering and sorting for the page and the export. `app/admin/products/toolbar.tsx`: the toolbar and row menu. `app/admin/products/export/route.ts`: the CSV (staff only).
  - `components/admin/list-controls.tsx`: `FilterCombobox` (URL-bound searchable filter) and `UrlFilterChips`.
- Why: Nicholas asked for the Products page to look like his design.
- Tested in the local preview, signed in as admin:
  - 74 products, "Showing 1–20 of 74".
  - The Low Stock card gave 5 products and a chip; Export with that filter returned a CSV of those 5, one row per SKU.
  - Category "wig" + Enter gave 8 Wigs and a chip, and reset to page 1.
  - The ⋯ menu works.
  - Page 2 → product → Back returned to `?page=2`.
  - 375 px: no sideways scroll.
  - `tsc --noEmit` passes.
- Follow-ups: move the filtering into the database when the catalogue grows (Known issues).

## 2026-11-04: Claude: Add / Edit Product as a tabbed workspace
- PR: (this PR, branch `claude/product-form-workspace`)
- Changed:
  - `app/admin/products/product-form.tsx`, rewritten (same data, same save functions):
    - **Header:** breadcrumb (Products › Add Product) and title. The Discard and Save Product actions and the tabs are pinned on desktop. It shows "Unsaved changes", an error banner, and a red dot on any tab that needs attention.
    - **Tabs:** Basic Details · Options & Variants · Pricing & Stock · Product Page. They switch instantly (local state, mirrored in `?tab=` by `history.replaceState`) and keep every value.
    - **Basic Details:** name, Category and Brand/Supplier as searchable comboboxes (brand accepts a new name), description, hair texture/type for hair, VAT, Featured and Visible. Product Media sits on the right.
    - **Options & Variants:** an option-type selector; a compact table with each option as a searchable combobox of values already in the catalogue (new ones allowed), SKU and status; Hide/Show and Remove; search when there are more than 8.
    - **Pricing & Stock:** one table with retail, wholesale, opening stock (or stock with Adjust), reorder level, SKU and status, using narrow numeric inputs. The 10+ wholesale rule is explained.
    - **Product Page:** benefits, how to use, ingredients, Featured, and the shop address (slug, read-only).
    - **Quick Preview**, on Basic Details and Product Page: main photo, name, brand, option, price and stock, with a choice of which option to preview.
    - **Validation** sits by each field (name, category, option, retail, wholesale ≤ retail, non-negative stock and reorder level). Save opens the first tab with a problem. Wholesale above retail shows as soon as it's typed.
    - **Unsaved work:** leaving with unsaved changes asks first (both the browser and in-app links). Discard asks, then reverts (edit) or goes back to Products (add).
  - `components/admin/photo-manager.tsx`: a drag-and-drop zone, "Make main" (star) on each photo, and a compact layout.
  - `components/combobox.tsx`: `allowCustom` ("Use “…”"), an `error` message, `hideLabel` and `variant="form"` (form-sized).
  - `app/admin/products/form-data.ts`: option values already in use (colours, shades, sizes, lengths).
  - The new and edit pages pass these through; the header moved into the form.
- Why: Nicholas asked for the Add Product page as a modern tabbed workspace instead of one long form.
- Not done: these need the database save functions (`admin_create_product` / `admin_update_product`) to accept more:
  - Colour + Length together (they take one option type per product);
  - a barcode per variant;
  - "Product Highlights" (no such field exists).
  These are follow-ups.
- Tested in the local preview, signed in as admin:
  - Add Product: typed a name → Options (Length, 2 options) → Pricing (1000 / 1500) → Basic. The tab switch took about 50 ms and the name was kept. "Wholesale price cannot exceed retail price" showed live.
  - Save opened Basic Details with "Category is required" and marked 3 tabs.
  - Clicking the Products breadcrumb asked "Leave without saving?", and Stay kept the work.
  - Edit Ballerina loaded name, category, brand, 2 photos and stock 16; Save Changes succeeded.
  - 375 px: no sideways scroll; the tabs scroll.
  - Found and fixed: tab switches took about 1 s (they re-fetched the page); the Pricing table scrolled sideways.
  - `tsc --noEmit` passes. I didn't create a new product in the live demo data.
- Follow-ups: Colour + Length combinations and barcodes in the save functions (migration); a test of creating a product.

## 2026-11-04: Claude: POS revamp to doctrine §22–§38 (variant-first, searchable filters)
- PR: (this PR, branch `claude/pos-variant-first`)
- Changed:
  - `components/combobox.tsx` (new, shared):
    - `Combobox`: opening it focuses the search; results narrow with every key, word-start matches first; arrow keys, Enter, Escape (focus returns) and Tab work; clear button; "No … matches" empty state; listbox ARIA; it opens towards the side with room, so it never runs off a phone screen.
    - `FilterChips` with Clear all.
  - `components/product-result-row.tsx` (new, shared): `ProductResultRow` (image, name — variant, category · brand, SKU, price, compact stock), plus `variantText()` and `stockText()`.
  - `app/admin/pos/product-finder.tsx`, rewritten:
    - filters are comboboxes with chips, and search, filters and tab are kept for the tab;
    - search is one row per exact variant within the active filters: arrow keys plus Enter adds, an exact SKU or barcode adds at once, Escape closes, focus returns to search after adding, and the empty state offers Clear filters / Try another search;
    - cards are variant-first: price and stock text at top, then name, variant, SKU, the wholesale break and one Add, white with a subtle border;
    - the product-level variant picker is removed, because results are already exact SKUs.
  - `app/admin/products/product-form.tsx`: Category is the shared combobox (sub-categories show their parent as a hint), with a "Choose a category" check on save.
- Why: Nicholas asked to build the POS changes from doctrine rules 22–38.
- Tested in the local preview, signed in as admin:
  - Category + "hair" showed Hair, Hair Pieces and Hair Care; "wig" + Enter picked Wigs; Color then offered only the 4 wig colours; Escape closed and returned focus; a Wigs chip appeared (22 matches).
  - "body wa" gave 6 variant rows with SKU, price and stock; Down ×4 + Enter added Honey Blonde 18" and cleared the search.
  - "best laa" showed the empty state with both actions.
  - POS → Recent Sales → Back kept the Wigs filter, chip and cart.
  - At 375 px there's no sideways scroll; the right-column dropdowns open leftward (found and fixed while testing).
  - Product form: "braid" + Enter chose Braids.
  - `tsc --noEmit` passes.
- Follow-ups (Known issues): the POS customer picker (no arrow keys yet), database search for large datasets, checkout town/county.

## 2026-11-04: Claude: Doctrine rules 22–38 (search, selection, filters, POS cards)
- PR: (this PR, branch `claude/doctrine-search-rules`)
- Changed:
  - `UX_NAVIGATION_DOCTRINE.md`: added Nicholas's rules 22–38 in three groups (search, selection and filters; POS product presentation; building blocks) and the final system rule ("search before scroll…"). The contents and section headings are grouped to match.
  - Enforcement now also covers dropdowns, comboboxes and product cards. Three more agent "don'ts". Review questions 12–15 added.
  - `.github/pull_request_template.md`: four matching checklist items.
  - `docs/PROJECT_STATE.md`: a decision row, and the Known issues audit extended with where the system falls short of the new rules. The main gaps:
    - there's no shared combobox, so long lists are still plain selects;
    - the POS filters have no chips and reset when you leave the POS;
    - POS search shows one row per product rather than per exact variant, and cards lack the SKU and compact stock text;
    - there's no empty state when search finds nothing;
    - search runs in the browser (deliberate for the offline POS);
    - checkout town and county are free text.
- Why: Nicholas made these rules mandatory system-wide.
- Tested: documentation only. I read the files back and checked the anchors and links.
- Follow-ups: rule 29 asks to revamp the POS cards. That's code, so it's a separate PR, together with the shared combobox (§35) that the POS filters will use first.

## 2026-11-04: Claude: UX Navigation Doctrine
- PR: (this PR, branch `claude/ux-navigation-doctrine`)
- Changed:
  - `UX_NAVIGATION_DOCTRINE.md` (new, repo root): Nicholas's doctrine, in full. It covers the 21 rules, enforcement, the developer/agent requirement, the PR review questions and the definition of done.
  - `.github/pull_request_template.md` (new): the PR sections from AGENTS.md §5 plus the UX Doctrine review checklist (11 questions, any "No" explained).
  - `AGENTS.md`:
    - pre-flight now reads the doctrine for UX work;
    - it's source of truth #5 (after PROJECT_STATE, before the design system), and mockups lose to it;
    - PR descriptions include the UX review;
    - definition of done includes doctrine compliance with the full chain tested on desktop and mobile;
    - the Lovable knowledge text includes it.
  - `docs/PROJECT_STATE.md`: decision row; repository layout; a Known issues audit of where the system doesn't comply yet (no paging on several admin lists, no drawers or master–detail, the receipt and thank-you dialogs, hardcoded Back links).
- Why: Nicholas asked for one doctrine that every change and PR is checked against.
- Tested: documentation only; links and section anchors checked by reading the files. No code changed.
- Follow-ups: work through the Known issues audit area by area. Before converting POS sale details from a page to a drawer, ask Nicholas: he asked for a page in PR #52, before the doctrine.

## 2026-11-04: Claude: POS lists and details as pages, not popups
- PR: (this PR, branch `claude/pos-pages`)
- Rule (Nicholas): pages for information, small dialogs only for confirmations.
- New pages inside the admin shell:
  - `/admin/pos/sales`: Recent Sales. Search covers order, customer and payment reference. Filters: date from/to, payment method, walk-in/registered customer, channel, min/max amount. Paged in the database (10/20/50, default 20), showing e.g. "Showing 1–20 of 30 sales".
  - `/admin/pos/sales/[number]`: Sale details. Customer, cashier, items, discount, VAT, payments and references, with Print Receipt, View Invoice and Order record.
  - `/admin/pos/suspended`: Active (soonest expiry first) and History tabs, search, the columns asked for, a live countdown, Resume / Extend / Release / View, and paging.
  - `/admin/pos/suspended/[reference]`: items held, customer, note and history, plus the actions.
- Small dialogs only for Extend (new expiry shown first) and Release, in `app/admin/pos/suspension-actions.tsx`. The POS's Recent Sales and Suspended Sales popups are removed (`suspended-sales.tsx` deleted).
- Back:
  - `components/admin/back-link.tsx`: `NavTrail` in the admin shell records this tab's pages. `BackLink` reads "← Back to <previous page>" and uses browser history, so search, filters, page and scroll return as they were. Opened directly, it goes to the page's parent.
  - Used on the new pages and on order, receipt, invoice and customer details.
- POS cart: kept in sessionStorage (`sparkle-pos-cart-v1`) across pages: lines, customer, discount and the resumed suspension. Resume from the Suspended Sales page opens `/admin/pos?resume=<id>`.
- Shared: `components/admin/list-controls.tsx` (FilterSelect, FilterInput, Pagination) and `lib/pagination.ts`. `LiveSearch` now resets `?page` when the search changes.
- Not added: Refund/Return on the sale page, because there's no refund function for completed sales.
- Tested in the local preview, signed in as admin:
  - POS (with 1 item in the cart) → Recent Sales → page 2 → sale SPK-1022 → Back landed on `?page=2`.
  - Search "SPK-1099" → sale → invoice ("Back to Sale SPK-1099") → Back → Back to the POS, with the cart intact.
  - Suspend → Suspended Sales page (Active (1), countdown) → Resume restored the cart with the "Resumed SUS-001004" note.
  - Detail page → Release dialog → Released.
  - Found and fixed two bugs: search kept the old page number; the cart was overwritten as empty on return.
  - `tsc --noEmit` passes.
- Earlier PR #51, now confirmed: after its migration was applied, suspend, extend, resume and pay (SPK-1099), automatic expiry by pg_cron, and release were all checked on the live database, with stock correct throughout.
- Follow-ups: none.

## 2026-11-04: Claude: POS refinement, suspended sales and search-first
- PR: (this PR, branch `claude/pos-suspended-sales`)
- **Suspended sales**, in the database. Migration `20261104120000_pos_suspended_sales.sql`:
  - tables `pos_suspensions` (`SUS-001001`…), `pos_suspension_items` and `pos_suspension_events`; staff read them, and changes go only through functions;
  - `pos_suspend_sale()` holds stock in `inventory_levels.reserved`, the same hold as online orders, so Available drops on the website and every till at once;
  - `pos_extend_suspension()` moves the expiry (within 7 days);
  - `pos_release_suspension()` returns the stock;
  - `pos_complete_suspended_sale()` releases the hold and records the sale through `pos_complete_sale()` in one transaction, so stock is deducted once;
  - `expire_pos_suspensions()` runs every minute through pg_cron (scheduled in the migration; if pg_cron isn't available the migration still applies), and on every till list as a backup;
  - every suspend, extend, release, expiry and completion is logged in events, and the list broadcasts on the admin topic.
- POS changes for suspensions:
  - Suspend (F6) with an optional note. The browser-only "Park" feature is removed.
  - A Suspended Sales (n) button and panel (`app/admin/pos/suspended-sales.tsx`): reference, customer, phone, items, total, note and a countdown (grey, amber under 6 h, red under 1 h).
  - Resume restores the cart, customer and discount; the stock stays held until payment. Extend offers +30 min to +24 h or a custom Nairobi time, showing the new expiry first. Release asks to confirm.
  - Paying a resumed sale goes through `pos_complete_suspended_sale`.
- **Search-first product area**, in `app/admin/pos/product-finder.tsx`:
  - The full catalogue no longer shows by default; instead there are tabs for Quick Picks (best sellers, 90 days), Recent Products (this cashier's sales), Fast-Moving (7 days) and Low Stock, all from real `order_items` and stock.
  - Search suggests as you type, across name, brand, category, colour, length and SKU, with image, attributes, brand and stock. Enter adds an exact SKU or barcode.
  - Filters: Category, Color, Size/Length, Brand/Supplier and Stock. They combine and only offer values that exist with the others.
  - A variant picker selects the exact variant (its SKU and stock record) by colour, shade, length and size.
  - Cards are compact and neutral.
  - Cart actions are now Clear, Suspend and Pay Now. Pink is kept for actions, active states and the total.
- Other: `lib/nairobi-time.ts`, shared with the order-estimate field.
- Left out: a separate supplier field (there's no suppliers table, so Brand is used); suspending while offline (the hold lives in the database).
- Tested in the local preview, signed in as admin:
  - the default tabs with real best sellers, and filter options from data;
  - "body wa" suggested 4 products with lengths, colour, brand and stock;
  - the picker showed 18" (BODYWAVELA-2) as out of stock with Add disabled, and added 14" to the cart;
  - Wigs narrowed colours, sizes and brands (22 matches);
  - `tsc --noEmit` passes.
- **Not tested yet:** suspend, extend, release, resume, pay, and expiry against the database. They need the migration, which is applied after merge.
- Follow-ups: apply the migration; check that pg_cron scheduled the job.

## 2026-11-04: Claude: Shopping incentives, and the cart and checkout redesign
- PR: (this PR, branch `claude/smart-incentives`)
- Decision (Nicholas, 2026-11-04): wholesale stays **per product at 10+ units of that product**. The cart total never triggers wholesale. A cart-value threshold applies only to free delivery (`store_settings.free_delivery_threshold`).
- Changed:
  - `lib/incentives.ts` (new): one rule for the website cart, checkout and POS.
    - Wholesale nudge: the product closest to its wholesale break. It's taken from the engine's own price breaks, so a saving appears only when the engine really has a cheaper price. It shows only when the customer is at least halfway there, and never asks for more units than are in stock.
    - Free delivery: amount remaining, progress and unlocked, worked out with `deliveryFee()`, the same rule as the database.
  - `components/shop/savings-nudge.tsx` (new): one calm card, soft pink while approaching and soft green when unlocked, with a progress bar.
  - Cart page (`app/(shop)/cart/page.tsx`) rebuilt to Nicholas's design: item cards with stock status and a quantity stepper, a trust strip, and an Order Summary with promo, a pink Total bar and the nudge.
  - Checkout (`wizard.tsx`):
    - a new header and stepper, and step cards with an icon tile and subtitle;
    - quantity and remove in the cart step, and inputs with icons in the details step;
    - pink-bordered delivery cards, and payment options with radio circles;
    - a summary with a pink total, the nudge and a trust row;
    - the summary follows the address as it's typed: delivery fee and free-delivery progress.
  - POS: the same wholesale nudge under the total, and a "Wholesale pricing applied" badge. There's no delivery at the till.
  - `LinePrice.breaks` in `lib/cart.tsx`; `DeliveryRules` exported from `lib/format.ts`.
- Not changed: the pricing engine, the database and the 10+ rule. The nudges only display what the engine already decides.
- Tested in the local preview:
  - Cart: 6 serums gave "Add 4 more…" until stock (3) was known, then the nudge hid itself. At 3 serums (KES 8,400) it showed "Add KES 1,600 more for free Nairobi delivery" with a progress bar. It updated instantly on quantity change.
  - Checkout: all 4 steps at 1440 width, and payment at 375 with no sideways scroll. Changing the town to Mombasa gave a KES 500 fee and "free Mombasa delivery"; pickup gave Free with no nudge.
  - POS: 6 × Body Wave 14" gave "Add 4 more… KES 13,900 each, saves KES 46,000". At 10 it applied wholesale automatically, with the badge.
  - `tsc --noEmit` passes.
- Not done: the decorative flower and perfume images from the mockups (no image assets).
- Follow-ups: none.

## 2026-11-04: Claude: Simpler customer tracking steps
- PR: (this PR, branch `claude/simpler-tracking-steps`)
- Changed:
  - `app/(shop)/order/[number]/order-data.tsx`: customers now see 4 delivery steps: Confirmed, Processing, Out for Delivery, Delivered. The internal `packed` status (Ready for Dispatch) counts as Processing until the order is `dispatched`.
  - `track/page.tsx`: a packed order's banner reads "Preparing your order · Your order is packed and will be on its way soon."
  - The order details timeline uses the same steps. Pickup stays at 4 steps (Confirmed, Processing, Ready for Pickup, Collected). The admin flow and the `order_status` enum are unchanged.
- Why: Nicholas asked for simpler, calmer customer tracking.
- Tested: local preview of SPK-1094 (delivered). The tracker shows 4 evenly spaced green steps with times. `tsc --noEmit` passes. Not seen in a browser: a packed order (it maps through the same stage list).
- Follow-ups: none.

## 2026-11-04: Claude: Delivery estimate is always Nairobi time
- PR: (this PR, branch `claude/eta-nairobi-time`)
- Changed: `app/admin/orders/[id]/order-actions.tsx`: the Estimated delivery field is read and shown as Nairobi time (UTC+3), not the device's timezone. It's labelled "(Nairobi time)".
- Why: found while testing #47 in a browser set to Los Angeles. "6:00 PM" would have been saved as 6 PM Los Angeles time (5 AM in Nairobi) and shown to the customer that way.
- Tested: on the live database after applying migration `20261103120000`, I moved test order SPK-1094 from the admin page through Processing → Packed → Dispatched (estimate 4 Nov, 6:00 PM) → Delivered, with its tracking page open in another tab. Each change appeared within about a second, with no reload (realtime, not the 30 s fallback). The banner showed "Estimated Delivery · Nov 4, 2026 · By 6:00 PM", then "Delivered Nov 4, 2026 at 12:44 AM." `tsc --noEmit` passes. Not tested: a signed-in customer (not staff) receiving the live update. The policy's customer check is the same expression, but only the staff branch was exercised.
- Follow-ups: none.

## 2026-11-03: Claude: Rider banner, delivery estimate and live tracking
- PR: (this PR, branch `claude/track-rider-banner`)
- Changed:
  - Nicholas's rider image is now a fixed asset, `public/brand/delivery-rider-banner.webp` (2000×667, unchanged). It's used as a full-width banner on the Track Order page.
    - Desktop: live text on the left, the image on the right, its plain left edge faded into the banner colour.
    - Phone: the text, then the image cropped to the rider.
    - The SVG rider (`components/shop/delivery-rider.tsx`) was removed.
  - Banner text by status:
    - Processing: "Preparing your order".
    - Ready for Dispatch: "Your order is packed and ready to leave."
    - Out for Delivery: "Estimated Delivery" with the date and "By <time>", or "Out for Delivery" if no estimate is set.
    - Delivered: "Delivered <date> at <time>", from the delivered event.
  - Migration `20261103120000_order_tracking_eta_live.sql`:
    - new column `orders.estimated_delivery_at`;
    - `set_delivery_estimate()`, staff only;
    - trigger `orders_broadcast_customer`, which broadcasts on the private topic `order:<id>` when status, payment or estimate changes;
    - a policy on `realtime.messages` so only that order's customer (and staff) receive it.
  - Admin order page: an "Estimated delivery" date-time field when an order is packed (saved as it's dispatched) or dispatched (Save).
  - `components/shop/live-order.tsx` replaces `components/auto-refresh.tsx`. The tracking page re-renders the moment staff move the order on, and polls every 30 s only while the live connection is down. `lib/live.ts` accepts `order:<id>` topics.
- Why: Nicholas sent the rider banner and asked for an estimated delivery from real data, with live updates.
- Tested:
  - Local preview of SPK-1094 at 1440 and 375 widths: the banner layout is as specified, with no sideways scroll. `tsc --noEmit` passes.
  - **Not tested:** the migration against the live database (the database tool refused the rolled-back test; check after applying); live updates end to end; the admin estimate field in a browser; the Out for Delivery and Delivered banner text in a browser.
- Follow-ups: apply the migration after merge, then test staff → customer live updates.

## 2026-11-03: Claude: Track Order page
- PR: (this PR, branch `claude/track-order-page`)
- Changed:
  - New page `app/(shop)/order/[number]/track/page.tsx`, to Nicholas's reference:
    - summary strip: number, date, current status and delivery method;
    - a 5-step progress bar: Confirmed, Processing, Ready for Dispatch, Out for Delivery, Delivered, each with the time it happened. Pickup orders get 4 steps: Confirmed, Processing, Ready for Pickup, Collected. On a phone the steps are stacked;
    - a pink "Delivery Update" card with a rider illustration (`components/shop/delivery-rider.tsx`, inline SVG);
    - the items with Qty; Delivery Details; "What's next?"; View Order Details and Contact Support.
  - Cancelled orders and till sales show their event list.
  - It refreshes itself every 30 s and when the customer returns to the tab (`components/auto-refresh.tsx`), because customers can't receive the staff realtime topic.
  - The order loading and stages moved to `app/(shop)/order/[number]/order-data.tsx`, shared with the details page. The details timeline now uses the same 5 stages.
  - Track Order on the details page and in the confirmation modal opens this page.
- Not built: the estimated delivery date and time, because no delivery estimate is stored or defined. The card shows where the order actually is instead ("Order confirmed", "On the way", "Delivered" with the date).
- Why: Nicholas asked that Track Order show this design.
- Tested: local preview of SPK-1094 (confirmed) at 1440 and 375 widths, with no sideways scroll. `tsc --noEmit` passes. Not seen in a browser: the later stages (processing through delivered), pickup, and cancelled orders, because there was no such test order to view.
- Follow-ups: an ETA needs a rule from Nicholas (e.g. same day in Nairobi, 1–3 days elsewhere) or a date staff set at dispatch.

## 2026-11-03: Claude: Order details page redesign
- PR: (this PR, branch `claude/order-details-page`)
- Changed:
  - `app/(shop)/order/[number]/page.tsx`, rebuilt to Nicholas's reference:
    - an account side menu (desktop);
    - Back to Orders, and "Order Details" with Download Invoice (if there's an invoice), Print Receipt (if paid) and Track Order;
    - a pink summary strip: number, date, status and total paid;
    - Items Ordered with photo, variant tags (colour, shade, length, size), price, qty and total, then subtotal, discount, VAT, delivery fee and Total Paid;
    - Need Help? → /contact;
    - Order Timeline in 4 customer stages (Confirmed, Processing, Out for Delivery / Ready for Pickup, Delivered / Collected); till and cancelled orders keep the event list;
    - Payment Information with a copyable reference and the payment date;
    - Delivery (or Pickup) Information.
  - A paid order still at `pending` shows as Confirmed to the customer.
  - `components/copy-button.tsx` (new), shared with the confirmation modal.
  - `app/(shop)/account/page.tsx`: anchors `#addresses`, `#notifications` and `#settings` for the side menu.
- Left out: "Payment Methods" in the menu (there are no saved payment methods) and "Expected Delivery" (no delivery date is stored). Neither was invented.
- Why: Nicholas asked that View Order Details open this design.
- Tested: local preview of SPK-1094 at 1440 and 375 widths. The layout matches, and there's no sideways scroll on a phone. `tsc --noEmit` passes. Not tested: a till order, a cancelled order or a split payment on this page (code paths kept from before).
- Follow-ups: none.

## 2026-11-03: Claude: Order confirmation modal
- PR: (this PR, branch `claude/order-confirmation-modal`)
- Changed:
  - `components/shop/order-confirmed-modal.tsx` (new), to Nicholas's reference. White card with a soft pink border and a wave along the bottom, and a round close button.
  - It shows: a green check with pink and yellow confetti; "Thank you, Grace!" and "Your order is confirmed."; an Order Number pill; a pink summary card. The card has rows for Total, Payment (green "M-Pesa – Paid" badge, or amber cash on delivery / pay at the shop), Reference with a copy button, and Delivery.
  - Below the card: the updates line, Track Order (`/order/<n>#tracking`), Continue Shopping (`/shop`) and View Order Details (`/order/<n>`). Escape or X closes it.
  - `app/(shop)/checkout/wizard.tsx`: the confirmation step opens the modal. A small card stays behind it, with View Confirmation (opens it again) and View Order Details.
  - `app/(shop)/order/[number]/page.tsx`: `id="tracking"` on the tracking card.
- Why: Nicholas asked for the confirmation to match his design.
- Tested:
  - Local preview with SPK-1094's details in the checkout state, at 1280 and 375 widths. The layout matches; on a phone nothing wraps or scrolls sideways.
  - Close works, and the link targets are correct. `tsc --noEmit` passes.
  - Not tested: the copy button actually copying, because the preview browser blocks the clipboard. A browser fallback is in place.
- Follow-ups: none.

## 2026-11-03: Claude: M-Pesa payment modal redesign
- PR: (this PR, branch `claude/mpesa-modal`)
- Changed:
  - `components/shop/mpesa-modal.tsx` (new): the checkout M-Pesa prompt to Nicholas's reference. White card, 28px corners, `min(92vw, 520px)` wide; M-Pesa mark on soft green; "Check your phone"; number in bold as +254 …; grey #F5F5F7 instruction box with the amount in bold and the shop name in #E6007E; countdown ring (5 min, pink arc); "Waiting for payment…"; Resend Request (30 s cooldown); Cancel Payment; pale pink wave. States: waiting, paid (green check, reference, continues by itself after ~2 s or on Continue), failed, expired, cancelled, each with Send New Request.
  - It reads `orders.payment_status` every 3 s, so a real M-Pesa callback would be picked up with no reload.
  - The demo simulation moved out of the card into a dark "Demo mode" strip below it (Approve / Decline). The big "Simulate Successful Payment" button is gone.
  - `app/(shop)/checkout/wizard.tsx`: uses the modal; the old inline modal and `simulateMpesa` removed. The modal stays up until the confirmation step loads, so the "already placed" card no longer flashes.
- Why: Nicholas asked to revamp only the payment popup to match his reference, with live states and the demo control kept apart.
- Tested: local preview as Grace, desktop (1280) and phone (375) widths. Decline → failed, Send New Request → waiting, Cancel → cancelled, Approve → "Payment successful" with reference → confirmation (SPK-1094 and SPK-1095, paid test orders in the live demo DB). Phone layout scrolls with nothing cut off. `tsc --noEmit` passes. Not tested: letting the 5-minute timer run out (expired state), and the transition fix after the last change (checked by code, not re-run).
- Follow-ups: real Daraja STK push and callback when M-Pesa credentials are available.

## 2026-11-02: Claude: Receipt as a PDF: print at receipt size, share on WhatsApp
- PR: (this PR, branch `claude/receipt-pdf`)
- Changed:
  - `lib/receipt-pdf.tsx` (new): the receipt as a PDF, same design, 80 mm wide and exactly as long as the content. Woff font copies added to `public/fonts`; the woff2 receipt fonts moved there from `lib/fonts`.
  - `components/receipt-actions.tsx` (new): Print (prints the PDF from a hidden frame), PDF download, Share PDF (Web Share with the file), Send on WhatsApp (customer number + private link). Used in the till dialog, both receipt pages and the link page. `components/print-button.tsx` removed; the old plain-text receipt removed.
  - Migration `20261102120000_receipt_links.sql`: `orders.receipt_token` and `public_receipt()`. New page `/r/[token]` (no sign-in, not indexed). `completeSale` returns the token.
- Why: Nicholas asked that the receipt reach customers on WhatsApp as the file (PDF, same design and size), and that printing uses the receipt size without wasting paper.
- Tested:
  - PDFs rendered for a 1-line and a 7-line receipt: one page each, 80 mm wide, height fits the content (592 and 892 pt), fonts and logo embedded.
  - Live database, in a block that rolled back: tokens unique; the link returns a paid order's receipt; unpaid or unknown tokens return nothing; anon still can't read orders.
  - `tsc --noEmit` and `next build` pass.
  - Not tested yet: the link page, Print, Share PDF and WhatsApp in a browser (need the migration, applied after merge); printing on a real receipt printer.
- Follow-ups: apply the migration after merge; WhatsApp Business API if fully automatic sending is wanted.

## 2026-11-02: Claude: Receipt to Nicholas's type and colour spec
- PR: (this PR, branch `claude/receipt-spec`)
- Changed: `components/receipt-document.tsx`: Inter (400/500/600/700, Arial/Helvetica fallback) for everything and Dancing Script only for the thank-you line; his colours (navy #0F1738, body #252B3A, muted #6B7280, dividers #D7DCE5 solid and #9CA3AF dashed, pink #E6007E for the total and slogan only, #FDEBF3 table heading and total box); his sizes (RECEIPT 24px/700, metadata 11.5px, table heading 10.5px/700 uppercase, products 12.5px/600, SKU 9.5px, money 12.5px/600, TOTAL 21px and amount 24px/700, thank-you 21px, slogan 10.5px/600 with 0.25em spacing); money in tabular figures, right-aligned; logo 110px wide; 85px QR area.
- Why: Nicholas sent an exact typography and colour spec for the receipt.
- Fonts are bundled (`lib/fonts`: Inter 400–700 and Dancing Script 500, SIL OFL, from Fontsource) through `next/font/local`, because a local build failed once when downloading Google fonts.
- Note: the QR stays an empty, labelled 85px space (black on white once KRA issues one).
- Tested: local preview of SPK-1077: computed fonts, sizes, weights and colours match the spec. `tsc --noEmit` and `next build` pass.
- Follow-ups: none.

## 2026-11-02: Claude: One receipt design across the system
- PR: (this PR, branch `claude/receipt-design`)
- Changed:
  - `components/receipt-document.tsx` (new): Nicholas's receipt mockup as a till-roll slip (logo, address, KRA PIN; RECEIPT with No/Date/Time/Cashier or "Sold: Online shop"/Customer; Qty-Item-Amount with VAT; subtotal, VAT, pink Total; payment method, reference, amount paid, change; points earned and tax invoice no.; handwritten thank-you; eTIMS QR placeholder; GLOW • SLAY • SPARKLE).
  - `lib/receipt.ts` (new): `ReceiptData` and the plain-text copy; `lib/receipt-data.ts` (new): receipt from an order (RLS decides access).
  - Till: the receipt pop-up uses it, with the cashier's name (`app/admin/pos/page.tsx` passes it); `completeSale` returns each line's amount with VAT.
  - New pages `/admin/orders/[id]/receipt` and `/order/[number]/receipt`, linked as "Print receipt" (admin order) and "View receipt" (customer order) when paid. `components/print-button.tsx` (new).
  - `app/globals.css`: only the receipt prints when one is shown, on an 80 mm page.
- Why: Nicholas asked to use his receipt design throughout the system.
- Tested (local preview, live data): receipt page for SPK-1077 (till, cash) and SPK-1045 (online, M-Pesa) match the mockup; a till sale (SPK-1081, Ballerina, KES 200 cash) shows the new receipt with amount paid KES 200 and change KES 26, tax invoice INV-1004; the browser accepts the 80 mm print page. `tsc --noEmit` and `next build` pass.
- Not tested: printing on a real receipt printer; the customer view of the receipt (same component, customer access by RLS).
- Follow-ups: none.

## 2026-11-02: Claude: System check, and indexes on foreign keys
- PR: (this PR, branch `claude/fk-indexes`)
- System check (no changes): deploy, migrations (22 = 22), typecheck, RLS on every table with policies, security-definer functions all with a fixed search_path; anon can call only the public catalogue/stock/quote/VAT-rate functions. Orders, payments, stock, loyalty and invoices all reconcile. Live pages 0.5–0.8 s warm. Found: 25 foreign keys without an index; 6 paid online orders still "pending" and 1 unpaid order (SPK-1078) from 30 Oct; 2 variants out of stock, 8 low; PostCSS advisory inside Next.js (fix needs Next 16); 38 old remote branches. The Supabase advisors tool returned "no permission" for this account, so the checks were done in SQL.
- Changed: migration `20261102090000_foreign_key_indexes.sql` adds the 25 indexes.
- Why: Nicholas approved adding the indexes after the check.
- Tested: live database in a block that rolled back: no foreign key left without an index; nothing kept.
- Follow-ups: apply after merge; Nicholas to process the waiting orders; Next 16 upgrade and branch clean-up when wanted.

## 2026-10-31: Claude: Sparkle-styled WhatsApp button
- PR: (this PR, branch `claude/whatsapp-sparkle`)
- Changed: `components/shop/whatsapp-chat.tsx`: the WhatsApp logo button uses a light Sparkle pink-to-blue gradient (#f074b2 → #ea5ea3 → #5ac7f7, lightened at Nicholas's request; the white logo sits on the ~3:1 mid pink), with three small four-point sparkles that twinkle in turn and a soft pink glow; the contact list has a matching gradient header and icons. `app/globals.css`: `sparkle-twinkle` and `sparkle-glow` animations, switched off for people who ask their device to reduce motion.
- Why: Nicholas asked for the WhatsApp button to be Sparkle inspired. (WhatsApp's brand guidelines prefer their green; noted to Nicholas.)
- Tested: local preview: button and twinkling sparkles show; the list shows Support, Admin and Sales with gradient icons. `tsc --noEmit` passes.
- Follow-ups: none.

## 2026-10-31: Claude: WhatsApp logo button
- PR: (this PR, branch `claude/whatsapp-icon`)
- Changed: `components/shop/whatsapp-chat.tsx`: the floating "Chat on WhatsApp" pill is now a round button with the official WhatsApp logo in WhatsApp green (glyph from Simple Icons, CC0); the contact list uses the same logo. It still asks who to message when there are several contacts.
- Why: Nicholas asked for just the official WhatsApp icon.
- Tested: local preview (live data, 3 contacts): the green logo button shows bottom right; tapping it lists Support, Admin and Sales with the logo; Escape closes it. `tsc --noEmit` passes.
- Follow-ups: none.

## 2026-10-31: Claude: WhatsApp contacts with a chooser; Maureen is the main contact
- PR: (this PR, branch `claude/whatsapp-contacts`)
- Changed:
  - Migration `20261101180000_whatsapp_contacts.sql`: `store_settings.whatsapp_contacts` (labelled list) replaces `whatsapp`; Maureen (Support, 0702 388 724) is the main contact.
  - `components/shop/whatsapp-chat.tsx` (new): the floating button opens the chat directly with one contact, or lets the customer choose (label and number) when there are several.
  - Settings: "WhatsApp contacts" list (label + number, add/remove); phone numbers use the same editor (`ContactList`).
  - Main contact (`mainWhatsapp()`) used on invoices (page and PDF), the shop footer, the homepage support card and the admin help link. Contact page shows only the main number, for WhatsApp and calls.
- Why: Nicholas asked for Maureen's number instead of his on invoices and the contact page, and for the chat button to offer several labelled numbers (support, sales, admin).
- Tested: live database in a block that rolled back: contacts set to Maureen, old column gone, a non-list refused; nothing kept. `tsc --noEmit` and `next build` pass. The chooser and pages can only be checked live after the migration is applied.
- Follow-ups: add Sales/Admin numbers in Settings when known.

## 2026-10-31: Claude: Invoices show the shop KRA PIN from Settings
- PR: (this PR, branch `claude/invoice-kra-pin`)
- Changed:
  - Migration `20261101150000_invoice_seller_kra_pin.sql`: fills the shop PIN on invoices issued before it was saved (INV-1001), unless sent to eTIMS; trigger `store_settings_fill_invoice_pin` does the same on future saves.
  - `components/invoice-document.tsx`, `lib/invoice-pdf.tsx`: use the PIN in Settings if the invoice has none, and never print "Not set" (the line is hidden if there is no PIN at all).
- Why: Nicholas saw "KRA PIN: Not set" on INV-1001 although the PIN is in Settings.
- Tested: live database in a block that rolled back: INV-1001 gets P050948567T; a later PIN change in Settings doesn't rewrite it; nothing kept. `tsc --noEmit` and `next build` pass.
- Follow-ups: apply the migration after merge.

## 2026-10-31: Claude: Invoice footer from Nicholas's second template
- PR: (this PR, branch `claude/invoice-footer`)
- Changed: `components/invoice-document.tsx`, `lib/invoice-pdf.tsx`: no colour band at the top; the eTIMS notice has the QR area beside it; new footer with thanks, hours and WhatsApp, "Glow · Slay · Sparkle" in a handwriting font with a heart flourish, the shop's categories (`INVOICE_FOOTER_CATEGORIES`), and a soft pink wave and leaf. In the PDF the footer sits at the bottom of every page. Added `great-vibes-400.woff`; removed the unused serif italic.
- Why: Nicholas preferred a second template. Agreed changes from it: keep the official logo (the image had another one), show the slogan once (in the footer), keep the thank-you, hours and contact line, keep the QR as a placeholder until KRA issues one, and use the real KRA PIN.
- Tested: PDF for INV-1001 rendered and checked visually; the on-screen invoice checked at desktop width. `tsc --noEmit` and `next build` pass.
- Follow-ups: none.

## 2026-10-31: Claude: Invoice to Nicholas's template
- PR: (this PR, branch `claude/invoice-template`)
- Changed: `components/invoice-document.tsx` and `lib/invoice-pdf.tsx` rebuilt to Nicholas's invoice image: pink/blue band, serif shop name, invoice number with a green Paid badge, facts row with the total in pink, Billed to and Payment details cards, pink table header with #, VAT column titled "VAT (16%)" when all lines share one rate (else per-line rates), tax summary with a total row, pink totals box, amber eTIMS notice, footer with hours and "Glow · Slay · Sparkle". `vatHeading()` added to `lib/invoices.ts`. Serif font files added.
- Why: Nicholas sent the template to use.
- Deviation from the template: its QR code is shown as an empty placeholder labelled "Available after transmission". A real KRA QR exists only after eTIMS accepts the invoice, so a printed sample QR would mislead anyone scanning it.
- Tested: PDFs rendered for the template case (INV-1001, cash, KES 174) and a busier case (discount, delivery, exempt line, split payment) and checked visually; the on-screen INV-1001 page checked at desktop and phone width (no sideways scroll). `tsc --noEmit` and `next build` pass.
- Follow-ups: none.

## 2026-10-31: Claude: Make the invoice PDF in the browser
- PR: (this PR, branch `claude/invoice-pdf-browser`)
- Changed:
  - `components/invoice-actions.tsx`: View PDF and Download PDF make the PDF in the browser (the PDF module loads on click), open it in a new tab or save it as `INV-…_Sparkle.pdf`.
  - `lib/invoice-pdf.tsx`: `invoicePdf()` returns a Blob; fonts and logo come from the site's `public/` files.
  - Removed the server PDF routes, `lib/invoice-response.ts` and the `next.config.ts` PDF settings from #31. `InvoiceBundle` moved to `lib/invoices.ts`.
- Why: after #31 the live PDF still failed (500, now caught) while working locally. Vercel's logs and protected previews need Nicholas's Vercel login, so the cause couldn't be read; making the PDF in the browser removes the server step.
- Tested: local production build: View PDF on INV-1001 gives a 72 KB PDF with all four Plus Jakarta Sans weights and the logo image. `tsc --noEmit` and `next build` pass. Live check after deploy still to do.
- Follow-ups: none.

## 2026-10-31: Claude: Fix the invoice PDF on Vercel
- PR: (this PR, branch `claude/invoice-pdf-vercel`)
- Changed:
  - `lib/invoice-pdf.tsx`: reads the font files and logo from disk (logo passed as data) instead of fetching them from the site.
  - `next.config.ts`: `serverExternalPackages` for `@react-pdf/renderer`, and `outputFileTracingIncludes` so the PDF routes ship with `public/fonts` and the logo PNG.
  - `lib/invoice-response.ts`: logs a failure with the invoice number and returns a plain message.
- Why: after #30 deployed, the live `/admin/invoices/[id]/pdf` returned 500 while the same build worked locally.
- Tested: local production build (`next build` + `next start`): INV-1001 PDF downloads (200, `attachment; filename="INV-1001_Sparkle.pdf"`); the route's traced files include the 4 fonts, the logo and `@react-pdf`; a sample PDF rendered from disk assets shows the logo and brand font. Live check after deploy still to do.
- Follow-ups: none.

## 2026-10-31: Claude: Branded tax invoice with PDF view and download
- PR: (this PR, branch `claude/invoice-design`)
- Changed:
  - `components/invoice-document.tsx`: redesigned. Logo, brand colour band, invoice number and paid status, key facts (issued with year, order, currency, amount), Billed to and Paid with cards, item table (cards on phones), VAT summary, eTIMS status, totals box, thank-you footer with hours and WhatsApp.
  - `lib/invoice-pdf.tsx` (new) and PDF routes `/admin/invoices/[id]/pdf`, `/order/[number]/invoice/pdf`: the same design as an A4 PDF in the site font; "View PDF" opens it, "Download PDF" saves it as `INV-…_Sparkle.pdf`. An order with a credit note gets both pages in one file.
  - `lib/invoice-data.ts` (new): loads an invoice with its order's payments and the shop details. `lib/invoice-response.ts` (new): the PDF response.
  - `components/invoice-actions.tsx` replaces `components/print-button.tsx` (removed).
  - `lib/format.ts`: `formatDateTimeFull` (date with the year, for documents).
  - New dependency `@react-pdf/renderer` 4.9.0; logo PNG and font files for the PDF.
- Why: Nicholas asked for an invoice with the logo, cleaner branded fonts and a well-organised layout that can be previewed, viewed and downloaded. Printing from the in-app browser had no preview.
- Tested:
  - Local preview of INV-1001: the page renders and `/pdf` returns `application/pdf` (71 KB, `INV-1001_Sparkle.pdf`).
  - A sample PDF with a discount, delivery, an exempt line and a split payment was rendered and checked visually; columns align and totals match.
  - `tsc --noEmit` and `next build` pass.
  - Not tested: the phone layout of the on-screen invoice, and the PDF on the live site until deployed.
- Follow-ups: shop KRA PIN still not set. The PIN sent in chat (P051234567X) is the example from the instructions, so it wasn't saved.

## 2026-10-31: Claude: VAT and KRA tax invoices (eTIMS-ready)
- PR: (this PR, branch `claude/etims-invoicing`, built on `claude/pos-checkout-flow`)
- Changed:
  - Migration `20261101120000_vat_and_etims_invoices.sql` (see PROJECT_STATE, Database 20): tax types on products, KRA PINs, VAT on orders and lines, the `invoices` table, automatic tax invoices and credit notes, and VAT in `place_order()` and `pos_complete_sale()`.
  - `lib/tax.ts` (new): the same VAT rule as the database, in whole cents; tax type labels; KRA PIN check.
  - Till: VAT per line on top of prices, VAT row, receipt shows VAT and the tax invoice number.
  - Cart and checkout: VAT row; totals include VAT.
  - Admin: Invoices list (eTIMS queue, credit notes, search) and printable tax invoice; order page shows VAT and links its invoice; Settings → Tax and KRA (shop KRA PIN, VAT registered); product form → VAT tax type; customer page → KRA PIN.
  - Customer: order page shows VAT and "View tax invoice".
  - `kes()` shows cents when an amount has them.
- Why: Nicholas asked for invoicing and tax for KRA eTIMS. Decisions: VAT registered, prices VAT-exclusive, build now and connect eTIMS when the KRA credentials are available.
- Tested:
  - Live database, in a block that rolled back: a till sale paid at the pre-VAT amount is refused (KES 46.40 still to pay); a sale with a discount and an exempt item gives VAT 42.79 and total 480.79, and the invoice lines add up to the total; not VAT registered gives type D and no VAT; an online order gets VAT on delivery, no invoice until paid, an invoice after `pay_order`, and a credit note after `cancel_order`; the customer sees only her own invoices; anon sees none; `apply_order_tax` can't be called from the API. Nothing was left behind.
  - `lib/tax.ts` gives the same figures as the database for those cases.
  - `tsc --noEmit` and `next build` pass.
  - Not tested in the browser: the screens need the migration, which is applied after merge.
- Follow-ups: apply the migration right after merge (the till refuses pre-VAT payments once it's applied); set the shop KRA PIN; connect eTIMS when KRA credentials arrive.

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
