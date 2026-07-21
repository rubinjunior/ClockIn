# ClockIn engineering rules

- Use Next.js App Router, strict TypeScript, Server Components by default, and Zod at trust boundaries.
- Keep Hebrew UI strings in `src/lib/i18n/he.ts`; visible UI is Hebrew-only, RTL, `he-IL`, `Asia/Jerusalem`, 24-hour time, ILS.
- Meet WCAG 2.2 AA: semantic controls, visible focus, keyboard support, 44px targets, reduced motion, and no per-second live announcements.
- Use logical CSS properties and test 375px, tablet, and desktop layouts without horizontal scrolling.
- Store timestamps as `timestamptz`; group with the user's IANA timezone; calculate in integer minutes.
- Never trust client user IDs. Every user table needs RLS. Service keys stay server-only. Mutations use authenticated RPC/server paths.
- Keep UI light: no global state library, large chart/PDF/date packages, or decorative animation runtime.
- Run `npm run check` and relevant Playwright tests before declaring completion.
