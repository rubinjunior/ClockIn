# Database schema

`profiles` extends `auth.users`. Effective-dated `work_schedule_versions` owns seven `work_schedule_days`; `employment_terms` stores display mode and rates. GiST exclusion constraints prevent overlapping effective periods.

`time_entries` stores raw clock/manual sessions with soft deletion and an audit trigger. `time_adjustments` stores explicit balance corrections. `leave_entries` and `leave_balance_adjustments` separate usage from configured entitlement. `calendar_exceptions` changes expected targets without changing work records.

`reminder_settings`, `push_subscriptions`, and `notification_deliveries` implement timezone-aware, retry-safe Push. `audit_logs` is append-only from the user's perspective.

Key functions:

- `start_clock()` and `stop_clock()` use `auth.uid()` and database timestamps.
- `soft_delete_time_entry()` scopes deletion to `auth.uid()`.
- `monthly_time_summary()` splits sessions at local day boundaries in SQL.
- `is_username_available()` returns one boolean and never reveals profile data.

The complete executable definition, policies, constraints, indexes, grants, triggers, and realtime publication are in `supabase/migrations/202607220001_initial_clockin.sql`.
