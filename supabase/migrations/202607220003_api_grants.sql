-- Explicit Data API grants. The project is created with automatic exposure disabled,
-- so every browser/server capability is intentional and reviewable here.
grant usage on schema public to anon, authenticated, service_role;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.employment_terms to authenticated;
grant select, insert, update on table public.work_schedule_versions to authenticated;
grant select, insert, update on table public.work_schedule_days to authenticated;
grant select, insert, update on table public.time_entries to authenticated;
grant select, insert, update, delete on table public.time_adjustments to authenticated;
grant select, insert, update, delete on table public.leave_entries to authenticated;
grant select, insert on table public.leave_balance_adjustments to authenticated;
grant select, insert, update, delete on table public.calendar_exceptions to authenticated;
grant select, insert, update, delete on table public.reminder_settings to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select on table public.audit_logs to authenticated;

-- Server-side reminder delivery uses the secret key/service role.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

revoke all on table public.profiles from anon;
revoke all on table public.employment_terms from anon;
revoke all on table public.work_schedule_versions from anon;
revoke all on table public.work_schedule_days from anon;
revoke all on table public.time_entries from anon;
revoke all on table public.time_adjustments from anon;
revoke all on table public.leave_entries from anon;
revoke all on table public.leave_balance_adjustments from anon;
revoke all on table public.calendar_exceptions from anon;
revoke all on table public.reminder_settings from anon;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.notification_deliveries from anon;
revoke all on table public.audit_logs from anon;

-- Anonymous users only need the privacy-preserving registration availability check.
grant execute on function public.is_username_available(text) to anon, authenticated;
