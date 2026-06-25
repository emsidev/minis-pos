# Mini's Pastries POS

Mini's Pastries POS is an offline-first point-of-sale app built with the Next.js App Router, Supabase, Dexie, Tailwind CSS, and shadcn/ui. The project is developed milestone by milestone, with a focus on reliable sales processing, offline support, and practical booth operations.

## Local Setup

1. Install the dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example`, then provide the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_NAME=Mini's Pastries
OFFLINE_SNAPSHOT_SIGNING_KEY=...
```

`OFFLINE_SNAPSHOT_SIGNING_KEY` is a server-only key used to sign the cached employee profile for offline navigation. Provider-added Postgres or Supabase secret variables are not part of the app configuration contract.

Booth location search and booth detail map previews use OpenStreetMap tiles with Nominatim search, so no separate map API key is required.

3. For the disposable development database, run the following SQL files in the Supabase SQL editor in order:

```text
supabase/reset.sql
supabase/schema.sql
supabase/seeds/demo.sql   # optional fixture data
```

`schema.sql` creates the private `receipts` storage bucket and its access policies. Sign in once to create the demo employee row before applying the optional fixtures. Demo non-cash rows include receipt paths; upload the matching demo objects only if you need to preview those photos.

4. Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Authentication and Receipts

- Users can sign in with email and password or with Google OAuth. The first successful login creates or claims an `employee` profile by email.
- Email authentication must be enabled in Supabase Auth Providers for password sign-in and password reset. Password setup and recovery use `/forgot-password`, `/reset-password`, and `/auth/recovery`.
- Add the allowed redirect URLs in Supabase Auth URL Configuration before testing authentication. Include `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/recovery`, and each deployed preview or production equivalent.
- Enable the Google provider in Supabase Auth Providers and add the matching Google OAuth client credentials before using Google sign-in.
- Promote the first admin by setting the employee row `role` to `admin` in Supabase, then sign in again.
- Non-cash transactions require a receipt photo. Photos are stored privately under `receipts/<employee_id>/<sale_id>.<ext>`.
- The database stores `receipt_photo_path`; display flows request short-lived signed URLs instead of exposing public receipt URLs.

## Verification

Run these checks before committing:

```bash
npm run check
npm run build
```

Also verify the Counter, receipt capture, offline/reconnect sync, schedule detail, and admin booth management flows. Include booth OpenStreetMap search, manual map pinning, and the booth map tab. Test these flows at a 768px viewport using authenticated Supabase users.

## Project Status

Milestones 1-6 are implemented in the workspace. The current stabilization pass focuses on securing offline sale sync, private receipts, and repository conventions before Milestone 7, Admin Employee Management, begins. See [REQUIREMENTS.md](./REQUIREMENTS.md) for the project requirements.

Design reference exports retained for implementation comparison are stored in `docs/design-reference/`.
