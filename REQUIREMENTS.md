# Mini's Pastries POS — Requirements Tracker

## How to use
Update the status of each item as work progresses.
Statuses: `[ ]` not started | `[~]` in progress | `[x]` complete | `[!]` blocked

---

## Milestone 1 — Foundation & Authentication
- [x] Project scaffolded (Next.js, Tailwind, shadcn)
- [!] Supabase tables created (SQL prepared in `supabase/schema.sql`; run it in your Supabase project)
- [!] RLS policies applied (included in `supabase/schema.sql`; apply it in your Supabase project)
- [x] Login page (magic link)
- [x] Role-based redirect (admin vs employee)
- [x] Route protection middleware
- [x] Basic layout shells

## Milestone 2 — POS Cashier Screen
- [ ] Product grid with category filters
- [ ] Cart with quantity controls
- [ ] Payment method selector (Cash, GCash, Maya, Maribank, UnionBank, Other)
- [ ] Receipt photo capture (required for non-cash)
- [ ] Charge button logic (disabled without photo for non-cash)
- [ ] Sale saves to Supabase
- [ ] Active booth in employee header

## Milestone 3 — Offline Mode
- [ ] Dexie.js local DB setup
- [ ] Products cached locally
- [ ] Sales saved offline with synced=false
- [ ] Sync on reconnect
- [ ] Receipt photo stored as base64 offline
- [ ] Offline badge in header
- [ ] Pending sync counter

## Milestone 4 — Employee Schedule View
- [ ] /schedule calendar page
- [ ] Monthly calendar with assigned booths
- [ ] Active shift detection
- [ ] Active booth + Maps link in header during shift

## Milestone 5 — Employee Sales History
- [ ] /sales list page
- [ ] Date filter
- [ ] Expandable sale detail with items + photo
- [ ] Sync status badge

## Milestone 6 — Admin Booth Management
- [ ] Booth list page
- [ ] Add/edit/deactivate booth (with location fields)
- [ ] Individual booth page with schedule calendar
- [ ] Add schedule form with conflict detection
- [ ] Unified all-booths calendar

## Milestone 7 — Admin Employee Management
- [ ] Employee list
- [ ] Invite by email (magic link)
- [ ] Edit role and status
- [ ] Deactivate employee

## Milestone 8 — Admin Dashboard & Products
- [ ] Dashboard with per-booth revenue cards
- [ ] Realtime updates
- [ ] Date picker
- [ ] Payment method breakdown
- [ ] Product list with availability toggle
- [ ] Add/edit product

## Milestone 9 — PWA & Polish
- [ ] manifest.json
- [ ] Apple PWA meta tags
- [ ] Service worker (next-pwa)
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Touch target audit
- [ ] iPad install test
