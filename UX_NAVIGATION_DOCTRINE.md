# Sparkle UX Navigation Doctrine

Navigation, context preservation and continuous user experience for the whole Sparkle Beauty & Cosmetics system: storefront, admin, POS, wholesale and every future module.

This doctrine is mandatory. Every developer, AI agent and coding assistant working on Sparkle treats these rules as architectural UX requirements. Don't override them casually. If a request conflicts with this doctrine, flag the conflict before changing the architecture (see [Enforcement](#enforcement)).

Adopted by Nicholas on 2026-11-04. Its place among the project's sources of truth is set in `AGENTS.md` §2.

---

## Contents

1. [Core principle](#1-core-principle)
2. [Choose the right interaction type](#2-choose-the-right-interaction-type)
3. [Preserve user state](#3-preserve-user-state)
4. [Back must mean real Back](#4-back-must-mean-real-back)
5. [Browser Back must also work](#5-browser-back-must-also-work)
6. [Don't reload the whole page](#6-dont-reload-the-whole-page)
7. [Master–detail experience](#7-masterdetail-experience)
8. [Pagination over endless scrolling](#8-pagination-over-endless-scrolling)
9. [Search first where appropriate](#9-search-first-where-appropriate)
10. [Filters must be modular](#10-filters-must-be-modular)
11. [Drawer navigation has its own history](#11-drawer-navigation-has-its-own-history)
12. [No popup mazes](#12-no-popup-mazes)
13. [Current work must not disappear](#13-current-work-must-not-disappear)
14. [The database is the source of truth](#14-the-database-is-the-source-of-truth)
15. [Real-time consistency](#15-real-time-consistency)
16. [Workflow continuity](#16-workflow-continuity)
17. [User input memory](#17-user-input-memory)
18. [Don't duplicate business rules](#18-dont-duplicate-business-rules)
19. [Major page vs contextual action](#19-major-page-vs-contextual-action)
20. [System-wide application](#20-system-wide-application)
21. [Agent and developer rule](#21-agent-and-developer-rule)
- [Enforcement](#enforcement)
- [PR review requirement](#pr-review-requirement)
- [Definition of done](#definition-of-done)
- [Final doctrine](#final-doctrine)

---

## 1. Core principle

The user must never unnecessarily lose their place in the system.

- Every action preserves context wherever possible.
- The system should feel like one connected workspace, not many disconnected pages.

Before creating any new navigation behaviour, ask: **can the user complete this action without losing the current workflow?** If yes, keep them in context.

## 2. Choose the right interaction type

Use this hierarchy.

| Type | Use for | Examples |
| --- | --- | --- |
| **Dedicated page** | Major modules or large datasets | Products, Orders, Customers, Inventory, Reports, POS, Wholesale, Checkout, Account, Suspended Sales |
| **Drawer / side panel** | Viewing or working with related information without leaving the current page | Customer, product, order, payment, inventory or delivery details; a suspended transaction |
| **Tabs** | One record with several related sections | see below |
| **Inline controls** | Small actions | Change quantity, select variant, edit note, change status, change customer, apply discount |
| **Modal** | **Only** short confirmations or very small focused actions | Confirm delete, confirm refund, release suspended stock, cancel payment, confirm logout |

Tab examples:

- Customer: Overview · Orders · Loyalty · Suspensions · Notes
- Product: Overview · Variants · Inventory · Sales
- Order: Summary · Items · Payment · Delivery · History

Do **not** use large modals for browsing records or completing long workflows.

## 3. Preserve user state

When the user moves into another related view, preserve their previous state, including:

- search terms, filters and sorting;
- pagination and scroll position;
- the active tab and selected records;
- entered form values and partially completed forms;
- the POS cart, selected customer, selected variants and discounts;
- checkout progress and delivery information.

When the user returns, the previous screen should look exactly as they left it, wherever reasonably possible.

## 4. Back must mean real Back

Back follows the user's actual path. Never hardcode Back buttons to arbitrary pages.

If the user went:

> Customers → Grace → Order SPK-1094 → Payment → Receipt

then Back goes:

> Receipt → Payment → Order SPK-1094 → Grace → Customers

- Don't jump straight to the Dashboard.
- Don't lose the previous search, filter or page state.

## 5. Browser Back must also work

Use proper routes and history where applicable, so the browser's Back button behaves naturally. Avoid navigation implementations that break browser history.

Routing and state management must allow these without destroying context unnecessarily:

- refresh;
- direct linking;
- browser Back;
- browser Forward.

## 6. Don't reload the whole page

Normal actions must not need a hard page refresh. Use:

- client-side navigation;
- realtime subscriptions;
- background revalidation;
- optimistic updates where safe, confirmed by the server.

These must all update without a full refresh:

- inventory, cart and pricing;
- payment status and order status;
- customer history and loyalty;
- suspended stock;
- reports;
- delivery tracking.

## 7. Master–detail experience

For list-heavy areas, prefer master–detail: the list in the main area and the selected record's details beside it (for example, the Orders list on the left and the selected order on the right). The user should be able to inspect several records without repeatedly leaving and returning to the list.

This applies to:

- customers;
- products;
- inventory;
- payments;
- suspended sales;
- wholesale accounts.

## 8. Pagination over endless scrolling

Don't dump hundreds of records into one long vertical page. Use:

- pagination;
- search, filters and sorting;
- tabs;
- page-size controls.

A typical pager shows **Showing 1–20 of 246 orders** with **Previous · 1 · 2 · 3 · … · Next**.

Prefer database (server) pagination for large datasets. Don't fetch everything just to paginate in the browser.

## 9. Search first where appropriate

For operational workflows, search is often the fastest way in.

- Search autocompletes: useful results appear before the user finishes typing.
- Typing `Best la` can immediately return: **Best Lady (Brown) — Wig**, Brown · 18" · Supplier: Best Lady · In Stock: 24.
- Results come from real database values.

## 10. Filters must be modular

Filters work together, for example:

- category, colour, size;
- supplier, status;
- date, customer, payment method, channel.

- Changing one filter must not accidentally destroy unrelated filters.
- Filters update results without a full-page refresh.

## 11. Drawer navigation has its own history

If a user opens related records inside a drawer, preserve that chain.

> Customer drawer → Order → Payment → Receipt

Back inside the drawer reverses it:

> Receipt → Payment → Order → Customer

Closing the drawer returns the user to the unchanged page underneath.

## 12. No popup mazes

Never create: Page → Modal → Modal → Modal → Drawer.

Avoid stacking interaction layers. The preferred shape is:

1. a page;
2. a drawer, then a nested detail inside it;
3. a small modal only if a confirmation is required.

## 13. Current work must not disappear

If a user is actively working on something, opening related information must not destroy it. For example:

- the POS cart stays intact while viewing customer history;
- checkout information stays intact when going Back;
- inventory filters stay intact while inspecting a product;
- a customer search stays intact after viewing an order.

Preserve unsaved values where it's safe to.

## 14. The database is the source of truth

No screen or component becomes its own independent source of business data. Every module uses the shared backend and database for:

- products, inventory and suspended stock;
- customers and loyalty;
- pricing, wholesale pricing and promotions;
- orders, payments and invoices;
- delivery;
- reports.

Frontend state is temporary UI state only.

## 15. Real-time consistency

If the same data is visible in several places, changes propagate immediately or through fast background synchronisation:

| When | Then |
| --- | --- |
| The website sells stock | The POS updates |
| The POS suspends stock | Website availability updates |
| Admin updates a customer | The POS and the customer's account reflect it |
| A payment completes | The order, the account and admin update |

Don't rely on users refreshing the browser.

## 16. Workflow continuity

Every workflow has a clear beginning, current position and next action. Multi-step flows provide:

- Previous, Next and Back;
- a progress indicator.

Never force users to restart because they viewed another screen.

## 17. User input memory

Within an active workflow, remember what's already been entered: checkout details, delivery address, selected product variant, customer selection, filters and form values.

Going Back must not empty fields unnecessarily.

## 18. Don't duplicate business rules

Shared rules live centrally. Don't implement separate versions in the website, POS, admin and wholesale. Rules this covers:

- wholesale pricing;
- inventory calculation;
- suspension expiry;
- tax calculation;
- delivery qualification;
- promotion eligibility.

One rule produces the same result everywhere.

## 19. Major page vs contextual action

| Before creating a… | Ask | If the answer is… |
| --- | --- | --- |
| New route | Does this task need its own workspace? | No → use a drawer, tab or inline action |
| Drawer | Does this need browsing many records or substantial work? | Yes → use a page |
| Modal | Is this only a short confirmation or a single focused action? | No → don't use a modal |

## 20. System-wide application

These rules apply to:

- **Storefront:** product browsing, product details, cart, checkout, customer account, order tracking, order history.
- **Admin:** dashboard, orders, products, inventory, customers, invoices, promotions, reports, AI insights.
- **POS:** product selection, cart, customer lookup, suspended sales, payments, recent sales.
- **Wholesale:** customers, orders, pricing, bulk quantities, payments.
- **Future modules:** any new module automatically inherits this doctrine.

## 21. Agent and developer rule

Before implementing **any** new action, component, screen or workflow:

1. Check this doctrine.
2. Identify the user's current context.
3. Decide whether the action is inline, drawer, tab, page or modal.
4. Preserve the previous state.
5. Maintain real navigation history.
6. Use shared database data.
7. Avoid full-page reloads.
8. Avoid unnecessary UI duplication.
9. Make sure Back returns correctly.
10. Test the full navigation chain.

A feature is **not** complete simply because the button works. It's complete only when the user can enter the workflow, perform actions, inspect related information, go deeper, return safely and continue exactly where they were.

---

## Enforcement

This document is a mandatory project doctrine. Review it before implementing or approving any change that affects:

- navigation, routing and Back behaviour;
- pages, drawers and modals;
- forms;
- lists and tables;
- search, filters and pagination;
- workflow state;
- realtime updates;
- user interaction flows.

### Developer and agent requirement

Before changing UX or navigation, the developer or AI agent must:

1. Read `UX_NAVIGATION_DOCTRINE.md`.
2. Identify the user's current context.
3. Decide whether the interaction belongs in a page, drawer, tab, inline control or modal.
4. Confirm how state will be preserved.
5. Confirm Back and browser Back behaviour.
6. Confirm whether pagination, search or filtering is required.
7. Confirm the database remains the source of truth.
8. Confirm no unnecessary full-page refresh is introduced.
9. Test the complete navigation chain.
10. Confirm compliance before considering the work complete.

### Agent rule

AI coding agents must not introduce new navigation patterns without checking this doctrine. When asked to build a new feature, the agent treats this document as an existing architectural constraint.

Don't:

- invent a new modal pattern because it's easier;
- hardcode Back destinations;
- reset filters on navigation;
- destroy unsaved workflow state;
- duplicate business state in frontend components;
- create endless scrolling record lists;
- do full-page reloads for normal application actions.

If a requested implementation conflicts with this doctrine, flag the conflict before changing the architecture.

## PR review requirement

Any PR that changes user interaction must include a **UX Doctrine review**. The PR template (`.github/pull_request_template.md`) carries the checklist. The PR author answers:

1. Does this preserve the user's current context?
2. Is the correct interaction type used (page, drawer, tab, inline, modal)?
3. Does Back return to the actual previous state?
4. Does browser Back behave correctly?
5. Are search, filter and pagination states preserved?
6. Are partially completed workflows preserved where appropriate?
7. Is a modal used only for a short, focused action?
8. Are large datasets paginated instead of endlessly rendered?
9. Are business records still sourced from the shared database?
10. Do relevant changes propagate without an unnecessary page refresh?
11. Have desktop and mobile navigation paths been tested?

If any answer is **No**, the PR must explain why. A UX change isn't merged just because it technically works.

## Definition of done

A UX feature is complete only when the user can **enter → work → inspect related information → go deeper → return → continue** from the exact context they left.

Technical completion without workflow continuity isn't complete.

## Final doctrine

- Never make the user lose their place.
- Keep related work together.
- **Pages** for major work.
- **Drawers** for context.
- **Tabs** for related information.
- **Inline controls** for small actions.
- **Modals** only for short confirmations.
- Back follows the real navigation chain.
- The database remains the source of truth.
- No unnecessary full-page refreshes.

Every future Sparkle feature respects these rules by default.
