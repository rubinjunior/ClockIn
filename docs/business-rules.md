# Business rules

- The database clock is authoritative. The UI interval is display-only. A partial unique index permits one non-deleted open entry per user.
- All stored instants use `timestamptz`; grouping uses the profile's IANA timezone. Durations and balances use integer minutes.
- Daily balance = worked + credited leave + adjustment − expected. Missing is the negative portion; overtime is the positive portion.
- A non-workday or full holiday has zero expected minutes. A shortened/special day supplies a custom target. Work remains visible on leave or holidays.
- Vacation and sick credit use the date-specific expected target. No legal accrual assumptions or overtime multipliers are built in.
- Future dates are excluded from missing time in “עד היום”; current-day results are provisional.
- Schedule and compensation changes create non-overlapping effective periods and never rewrite history.
- Edits and soft deletion preserve raw/audit history. Entries must end after they start and must not overlap, including open sessions.
- Cross-midnight sessions are split at local midnight, including month/year and daylight-saving boundaries.
- Reminder deliveries are unique by user, type, local date, and local time; failed/expired subscriptions can be disabled safely.
