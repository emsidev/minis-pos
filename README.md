# Mini's Pastries POS

Offline-first point of sale for Mini's Pastries, built milestone-by-milestone with Next.js 14 App Router, Supabase, Dexie, Tailwind CSS, and shadcn/ui.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and provide:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_NAME=Mini's Pastries
magiclink=false
OFFLINE_SNAPSHOT_SIGNING_KEY=...
```

`magiclink=false` switches login to email and password. Omit `magiclink` or set any value other than `false` to keep magic-link login.

`OFFLINE_SNAPSHOT_SIGNING_KEY` is server-only and signs the cached employee profile used during offline navigation. Provider-added Postgres or Supabase secret variables are not application configuration contracts.

Booth location search and booth detail map previews use OpenStreetMap tiles plus Nominatim search. No separate map API key is required.

3. For the disposable development database, run these SQL files in the Supabase SQL editor in order:

```text
supabase/reset.sql
supabase/schema.sql
supabase/seeds/demo.sql   # optional fixture data
```

`schema.sql` creates the private `receipts` storage bucket and its access policies. Sign in once to create the demo employee row before applying optional fixtures. Demo non-cash rows contain receipt paths; upload matching demo objects only if previewing those photos.

4. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication And Receipts

- Users sign in with Supabase magic links by default. Set `magiclink=false` to use Supabase email/password login instead. The first successful login creates an `employee` profile.
- For password login, Email auth must be enabled in Supabase Auth Providers, and each user must have a Supabase Auth password. Existing magic-link-only users need a password set through Supabase, an admin flow, or password reset.
- Password mode includes `/forgot-password` and `/reset-password` for self-service recovery and first-password setup. The recovery email returns through `/auth/recovery`.
- Add your allowed recovery URLs in Supabase Auth URL Configuration before testing password reset. Include `http://localhost:3000/auth/recovery` for local work and each deployed `/auth/recovery` URL for preview or production.
- Promote the first admin by setting the employee row `role` to `admin` in Supabase, then sign in again.
- Non-cash transactions require a receipt photo. Photos are stored privately under `receipts/<employee_id>/<sale_id>.<ext>`.
- The database stores `receipt_photo_path`; display flows request short-lived signed URLs instead of publishing receipt URLs.

## Verification

Run before committing:

```bash
npm run check
npm run build
```

Also verify Counter, receipt capture, offline/reconnect sync, schedule detail, and admin booth management, including booth OpenStreetMap search, manual map pinning, and the booth map tab, at a 768px viewport using authenticated Supabase users.

## Project Status

Milestones 1-6 have implementation in the workspace. The current stabilization pass secures offline sale sync, private receipts, and repository conventions before Milestone 7 (Admin Employee Management) begins. See [REQUIREMENTS.md](/C:/Users/McJoseph/OneDrive/EMSI/AI/Agency/mini-pos/REQUIREMENTS.md).

Design reference exports retained for implementation comparison live under `docs/design-reference/`.
