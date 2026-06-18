# AGENTS.md — Mini's Pastries POS

## Project context

This is a Next.js 14 App Router + Supabase + Tailwind PWA built milestone-by-milestone.
Never build ahead of the current milestone. Always check REQUIREMENTS.md for current status.

## Stack conventions

- Framework: Next.js 14 App Router (not Pages Router)
- All components are React Server Components by default; add `'use client'` only when needed
- Supabase browser client: import from `@/lib/supabase`
- Supabase server client: import from `@/lib/supabase-server`
- Offline DB: import from `@/lib/db` (Dexie instance)
- Sync logic: import from `@/lib/sync`
- Styling: Tailwind utility classes only — no inline styles, no CSS modules
- All UI components: shadcn/ui — do not build custom primitives for things shadcn already covers
- TypeScript strict mode — no `any`, no `// @ts-ignore`
- Naming: use `employee` everywhere, never `manager`

## File naming conventions

- Components: PascalCase (`ProductGrid.tsx`)
- Hooks: camelCase prefixed with `use` (`useActiveShift.ts`)
- Lib files: camelCase (`supabase.ts`, `db.ts`)
- Route files: Next.js conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)

## Database rules

- Never query Supabase directly in a component — always use a server action or a dedicated lib function
- Always handle the `error` return from Supabase queries — never assume success
- RLS is enabled on all tables — always test queries with a real authenticated user, not the service role

## Offline rules

- All writes during POS operation must go through the Dexie-first pattern (write local, then sync)
- Never write directly to Supabase from the POS screen — write to Dexie, let sync handle it
- Exception: admin screens (product management, booth management) write directly to Supabase

## Payment photo rules

- Non-cash payment methods MUST have a receipt photo before a sale can complete
- Store photos in private Supabase Storage bucket: `receipts/`
- Offline: store as base64 in Dexie field `receipt_photo_local`
- After sync: upload to `<employee_id>/<sale_id>.<ext>`, save the private object path to `receipt_photo_path`, clear `receipt_photo_local`
- Display: retrieve receipts through an authenticated short-lived signed URL; never store or render public receipt URLs

## Scheduling rules

- Always check for conflicts before saving a booth_schedule
- Conflict = same employee_id, same date, overlapping time (check in app layer before DB insert)
- Show user-friendly error message on conflict, never let DB constraint be the first line of defense

## POS Interface rules

- The Counter (POS) screen is the main workspace for employees and available to admins.
- Design: Follow the "Candy Theme" aesthetic (Primary: `#e040a0`, vibrant secondary colors, glassmorphism, 2rem/3rem corner radius).
- Sidebar: Roles determine visibility of items (Admins see all; Employees see Counter, Booth Inventory, Settings).
- Inventory: Employees must only see products assigned to their current booth schedule and time slot.
- Feedback: Product grid and cart must provide immediate visual feedback (e.g., active states, spring animations).

## Before committing any code

- Run `npm run check` — zero type, lint, or formatting errors allowed
- Test the feature on a 768px viewport (iPad portrait simulation in browser devtools)
- Update `REQUIREMENTS.md` to mark completed items

## Milestone discipline

- Only work on the current milestone
- Do not add features from future milestones even if "it's easy"
- When a milestone is complete, list what was built and ask for confirmation before continuing
