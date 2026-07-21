# ClockIn

ClockIn is a mobile-first, Hebrew-only personal time tracker. It uses Next.js App Router and Supabase to keep the live clock server-authoritative, protect each user's records with PostgreSQL RLS, preserve effective-dated work and compensation history, and deliver installable PWA reminders.

## Architecture

- Next.js Server Components load authenticated data; small Client Components handle the live timer, dialogs, online state, PWA registration, and notification permission.
- Supabase Auth uses secure cookies through `@supabase/ssr`. `src/proxy.ts` refreshes sessions and protects `/app` and `/onboarding`.
- PostgreSQL is the source of truth. `start_clock` and `stop_clock` use database time and a partial unique index guarantees one open entry per user.
- Calculation helpers live in `src/lib/time`; SQL performs month-limited aggregation. UTC `timestamptz` values are grouped in each profile's IANA timezone.
- Standard Web Push uses VAPID. A secret-protected Node route is designed for Supabase Cron and deduplicates deliveries in PostgreSQL.

## Prerequisites

- Node.js 20.9 or newer and npm
- A Supabase project (or Supabase CLI for local development)
- A Vercel project for production

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the public Supabase URL/anonymous key. Never put the service-role key in a `NEXT_PUBLIC_` variable.
3. Apply `supabase/migrations/202607220001_initial_clockin.sql` from the Supabase SQL editor, or run `supabase db reset` with a linked/local CLI project.
4. Optionally create one local auth user and run `supabase/seed.sql`.
5. Run `npm run dev` and open `http://localhost:3000`.

Generate current database types after linking the CLI:

```bash
npx supabase gen types typescript --linked > src/types/database.generated.ts
```

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe project values. `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` are server-only secrets. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public by design. Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin.

Generate VAPID keys once with `npx web-push generate-vapid-keys`. Use a `mailto:` or `https:` contact in `VAPID_SUBJECT`.

## PWA and notifications

The app registers `/sw.js`, exposes a Hebrew RTL manifest, caches the shell and offline page, and never claims an offline clock mutation succeeded. On Android, use the browser menu and “Install app”. On iOS, use Safari's Share menu and “Add to Home Screen”; Web Push requires a home-screen web app and a supported iOS version, and permission must follow a user gesture.

Configure Supabase Cron to `POST https://YOUR_DOMAIN/api/cron/reminders` every five minutes with `Authorization: Bearer YOUR_CRON_SECRET`. The route reads due timezone-aware reminders with a five-minute window, inserts a unique delivery record, sends active subscriptions, and disables expired endpoints.

## Commands

- `npm run dev` — development server
- `npm run lint` — lint
- `npm run typecheck` — strict TypeScript
- `npm test` — unit tests
- `npm run test:e2e` — Playwright on desktop Chrome, mobile Chrome, and mobile WebKit
- `npm run build` — production build
- `npm run check` — lint, types, unit tests, and build

Authenticated E2E flows require a dedicated Supabase test project and deterministic test credentials; never point destructive tests at production.

## Production deployment

1. Create a hosted Supabase project and apply the migration.
2. Set the Site URL and redirect URLs in Supabase Auth to the Vercel HTTPS domain.
3. Import the repository into Vercel and set every variable from `.env.example` in the Production environment.
4. Deploy, then configure the five-minute cron caller with the same `CRON_SECRET`.
5. Register once for push notifications from an installed PWA and verify a test notification.
6. Verify `/manifest.webmanifest`, `/sw.js`, login redirects, RLS with two test users, and the production browser console.

## Security and troubleshooting

RLS is enabled on every user-owned table. Audit and delivery records are read-only for users. Browser mutations never submit a user ID as authority. CSP, frame denial, referrer policy, MIME sniffing protection, Zod validation, test-notification throttling, and username-check throttling are included.

- “Supabase not configured”: check the two `NEXT_PUBLIC_SUPABASE_*` variables and restart Next.js.
- Push not offered: use HTTPS (or localhost), install on iOS, and trigger permission from the settings button.
- Clock already active: another device or tab owns the active entry; refresh to reconcile.
- Migration exclusion error: confirm `btree_gist` is enabled by a project owner.

ClockIn estimates work balances and compensation; it is not a payroll or legal-compliance system.
