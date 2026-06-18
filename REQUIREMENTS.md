# Mini's Pastries POS - Requirements Tracker

## How to use

Update the status of each item as work progresses.
Statuses: `[ ]` not started | `[~]` in progress | `[x]` complete | `[!]` blocked

---

## Milestone 1 - Foundation & Authentication

- [x] Project scaffolded (Next.js, Tailwind, shadcn)
- [x] Supabase tables created
- [x] RLS policies applied
- [x] Login page (magic link by default; email/password when `magiclink=false`)
- [x] Role-based redirect (admin vs employee)
- [x] Route protection middleware
- [x] Basic layout shells

## Milestone 2 - POS Cashier Screen

- [x] Responsive shell, navigation reliability, and current-screen polish for Counter, Booth Inventory, and admin placeholders
- [x] Product grid with category filters
- [x] Cart with quantity controls
- [x] Payment method selector (Cash, GCash, Maya, Maribank, UnionBank, Other)
- [x] Receipt photo capture (required for non-cash)
- [x] Charge button logic (disabled without photo for non-cash)
- [x] Sale saves to Supabase
- [x] Active booth detection for POS counter
- [x] Standardized "Candy Theme" UI components (Pills, Circles, KPI Strips)

## Milestone 3 - Offline Mode

- [x] Dexie.js local DB setup
- [x] Products cached locally
- [x] Sales saved offline with local pending/failed/synced state
- [x] Sync on reconnect
- [x] Receipt photo stored as base64 offline
- [x] Offline badge in header
- [x] Pending sync counter
- [x] Logged-in employee session remains usable across offline page navigation (admin stays online-validated)
- [x] First online session warms employee schedule, inventory, sales, and sale-item cache for offline use
- [x] Shift-start inventory and stock movements queue locally and sync before dependent sales

## Milestone 4 - Employee Schedule View

- [x] /schedule calendar page
- [x] Monthly calendar with assigned booths
- [x] Active shift detection (with Asia/Manila timezone support)
- [x] Integrated Shift Detail View (KPIs, Inventory, Sales) in drawer popup
- [x] Maps link in shift details

## Milestone 5 - Employee Sales History

- [x] Shift-based sales list (accessible via schedule)
- [x] Expandable sale details with per-item breakdown
- [x] Manual sales date filter

## Milestone 6 - Admin Booth Management

- [x] Booth list page
- [x] Add/edit/deactivate/reactivate booth with OpenStreetMap search, manual map pinning, saved location fields, and a booth detail map tab
- [x] Individual booth page with schedule calendar
- [x] Add/edit schedule assignment with conflict detection, editing lock, and retained cancellation history
- [x] Shared booth shifts with multiple assigned employees, one POS operator, and audited operator takeover
- [x] Employee shift-start opening inventory gate with active-shift stock adjustments
- [x] Audited active-shift admin stock overrides with required reasons
- [x] Unified all-booths calendar

## Stabilization Pass - Before Milestone 7

- [x] Atomic POS finalization RPC and private receipt-path storage contract prepared
- [x] Dexie sync state migration and oldest-first retry behavior implemented
- [x] Inventory/sale stock-basis conflict protection for offline reconnect and admin overrides
- [x] Signed offline employee snapshot contract implemented
- [x] Data/UI/repository conventions normalized and stale paths removed
- [x] Next.js patched from 14.2.31 to the requested 14.2.35 release line
- [x] Password recovery and first-password flow implemented for password mode (`magiclink=false`)
- [x] Admin dashboard/sales date pickers, data-table responsiveness, and route transition feedback stabilized
- [x] Compute-cost optimization pass implemented in code (lean dashboard aggregates, month-scoped schedule loading, sync/bootstrap dedupe, retry backoff, cache pruning, and redundant refresh removal)
- [x] Online operator handoff server-truth repair implemented (safe sale finalization lock path, server-first employee refresh, and failed-review isolation from live stock/sales)
- [!] Resolve newly reported high-severity `npm audit` advisories requiring a reviewed Next.js major-version upgrade beyond the current Next.js 14 project constraint
- [!] Apply `supabase/reset.sql`, `supabase/schema.sql`, and optional demo seed to the disposable development project
- [!] Run `EXPLAIN (ANALYZE, BUFFERS)` and large-data validation after applying the updated schema indexes/RPCs in Supabase
- [!] Validate RLS, receipt signed URLs, offline sync, and 768px interactions with authenticated test users

## Milestone 7 - Admin Employee Management

- [x] Employee list
- [x] Invite by email (magic link)
- [x] Edit role and status
- [x] Deactivate employee

## Milestone 8 - Admin Dashboard & Products

- [x] Dashboard with booth revenue reporting
- [x] Realtime updates
- [x] Date picker
- [x] Payment method breakdown
- [x] Product list with availability toggle
- [x] Add/edit product
- [x] Admin sales ledger page

## Milestone 9 - PWA & Polish

- [x] manifest.json
- [x] Apple PWA meta tags
- [x] Service worker (maintained Serwist integration)
- [x] Loading skeletons
- [x] Error boundaries
- [ ] Touch target audit
- [ ] iPad install test
