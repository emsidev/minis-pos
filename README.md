# Mini's Pastries POS

Production-ready, offline-first point of sale for Mini's Pastries. This repository is being built milestone-by-milestone with Next.js 14, Supabase, Tailwind CSS, and shadcn/ui.

## Prerequisites

1. Node.js 18 or newer
2. A free Supabase account
3. A free Vercel account

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project, then open the SQL editor and run the full contents of [supabase/schema.sql](/C:/Users/McJoseph/OneDrive/EMSI/AI/Agency/mini-pos/supabase/schema.sql).

3. In Supabase Auth, enable the Email provider and turn on magic links.

4. Create a Storage bucket named `receipts` and keep it authenticated-only.

5. Copy `.env.local.example` to `.env.local` if needed, then fill in your real Supabase URL and anon key.

6. Start the app:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000).

## First admin account

1. Sign in with your email using the magic-link flow.
2. After the first login creates your employee row, open the `employees` table in Supabase.
3. Change your row's `role` to `admin`.
4. Sign out and sign back in to land on `/admin/dashboard`.

## Verification commands

Run these before committing:

```bash
npx tsc --noEmit
npm run lint
```

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import the repo into [Vercel](https://vercel.com/).
3. Add the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_NAME` environment variables in Vercel.
4. Deploy.

## Install on iPad

1. Open the deployed Vercel URL in Safari.
2. Tap the Share button.
3. Choose `Add to Home Screen`.

## Project status

Only Milestone 1 has been implemented so far. Check [REQUIREMENTS.md](/C:/Users/McJoseph/OneDrive/EMSI/AI/Agency/mini-pos/REQUIREMENTS.md) before starting new work, and do not build ahead of the active milestone.
