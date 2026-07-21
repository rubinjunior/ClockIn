# Implementation plan

1. Foundation: Next.js, strict TypeScript, Tailwind tokens, Hebrew RTL shell, Supabase SSR, CSP, PWA shell.
2. Data: effective-dated schedules and terms, time/leave/exception/reminder records, audit log, RLS, transactional clock RPCs.
3. Product: authentication, resumable onboarding, dashboard clock, history/manual correction, monthly report/CSV/print, settings, notification subscription.
4. Quality: reusable timezone calculations, unit/E2E coverage, lint, typecheck, production build, mobile and accessibility inspection.

The deployed environment supplies Supabase, VAPID, and cron secrets; no secrets are committed.
