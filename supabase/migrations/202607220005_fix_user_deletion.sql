-- A hard user deletion cascades through time_entries. Auditing that cascade
-- attempts to insert a new row that still references the user being deleted,
-- which makes the Auth deletion fail. ClockIn uses soft deletion for entry
-- removals, so INSERT and UPDATE continue to cover application-level changes.
drop trigger if exists audit_time_entries on public.time_entries;

create trigger audit_time_entries
after insert or update on public.time_entries
for each row execute function public.audit_time_entry();
