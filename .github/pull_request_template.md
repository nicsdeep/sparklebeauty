## What changed and why

<!-- One focused change. What it does for the shop, the customer or staff, and why. -->

## How it was tested

<!-- Exactly what you ran or clicked, and what you saw. Say what you didn't test. -->

## Left undone

<!-- Anything not finished, or "Nothing". -->

## Migrations

<!-- Any file in supabase/migrations/ to apply after merge (`supabase db push --linked`), or "None". -->

## UX Doctrine review

<!--
Required when this PR changes user interaction: navigation, pages, drawers, modals, forms, lists,
tables, search, filters, pagination, workflow state, routing, Back behaviour or realtime updates.
Read UX_NAVIGATION_DOCTRINE.md first. Tick each item, or explain every "No" underneath it.
If this PR doesn't change user interaction, write "Not applicable" and delete the checklist.
-->

- [ ] It preserves the user's current context.
- [ ] It uses the right interaction type (page for major work, drawer for context, tab for related sections, inline for small actions, modal only for a short confirmation).
- [ ] Back returns to the actual previous state, not a hardcoded page.
- [ ] Browser Back (and Forward, refresh and direct links) behave correctly.
- [ ] Search, filter, sort and pagination states are preserved.
- [ ] Partially completed workflows (cart, checkout, forms) are preserved where appropriate.
- [ ] Any modal is only a short, focused action; there is no popup maze.
- [ ] Large datasets are paginated in the database, not rendered endlessly.
- [ ] Business records still come from the shared database, and shared rules aren't duplicated.
- [ ] Changes propagate without an unnecessary page refresh.
- [ ] Desktop and mobile navigation paths were tested, including the full chain there and back.
- [ ] Long selectable lists are searchable comboboxes from the shared component (type at once, arrow keys, Enter, Escape, clear).
- [ ] Filter values come from the database, depend on each other, show removable chips with Clear all, and survive going away and back.
- [ ] Product results and POS cards show the exact variant: variant, SKU, price and compact stock text.
- [ ] Large-dataset search runs in the database, debounced (~200–300 ms), cancels stale requests and has a clear empty state.
