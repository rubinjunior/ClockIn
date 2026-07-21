begin;

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create type public.compensation_mode as enum ('hidden','hourly','global');
create type public.entry_source as enum ('clock','manual','import');
create type public.leave_type as enum ('vacation','sick','custom');
create type public.leave_status as enum ('draft','approved','cancelled');
create type public.exception_type as enum ('holiday','shortened','day_off','special_workday');
create type public.reminder_type as enum ('clock_in','clock_out');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 30),
  normalized_username text not null unique,
  full_name text,
  timezone text not null default 'Asia/Jerusalem',
  locale text not null default 'he-IL',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employment_terms (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null, effective_to date,
  compensation_enabled boolean not null default false, mode public.compensation_mode not null default 'hidden',
  hourly_rate numeric(12,2) check (hourly_rate >= 0), monthly_salary numeric(12,2) check (monthly_salary >= 0),
  currency char(3) not null default 'ILS', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (user_id with =, daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&)
);

create table public.work_schedule_versions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, effective_from date not null, effective_to date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (user_id with =, daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&)
);

create table public.work_schedule_days (
  id uuid primary key default gen_random_uuid(), schedule_version_id uuid not null references public.work_schedule_versions(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), is_workday boolean not null default false,
  expected_start_time time, expected_end_time time, target_minutes integer not null default 0 check (target_minutes between 0 and 1440),
  unique(schedule_version_id, weekday)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  clock_in timestamptz not null default now(), clock_out timestamptz, source public.entry_source not null default 'clock',
  note text check (char_length(note) <= 500), edit_reason text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (clock_out is null or clock_out > clock_in)
);
create unique index one_active_time_entry_per_user on public.time_entries(user_id) where clock_out is null and deleted_at is null;
create index time_entries_user_clock_in_idx on public.time_entries(user_id, clock_in desc) where deleted_at is null;

create table public.time_adjustments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  adjustment_date date not null, minutes integer not null check (minutes between -1440 and 1440 and minutes <> 0), reason text not null,
  note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index time_adjustments_user_date_idx on public.time_adjustments(user_id, adjustment_date);

create table public.leave_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  leave_type public.leave_type not null, start_date date not null, end_date date not null, partial_minutes integer check (partial_minutes > 0),
  status public.leave_status not null default 'approved', note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_entries_user_dates_idx on public.leave_entries(user_id, start_date, end_date);

create table public.leave_balance_adjustments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  leave_type public.leave_type not null, minutes integer not null, effective_date date not null, reason text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.calendar_exceptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  exception_date date not null, exception_type public.exception_type not null, name text not null, target_minutes integer check (target_minutes between 0 and 1440),
  annually_recurring boolean not null default false, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, exception_date)
);

create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type public.reminder_type not null, enabled boolean not null default false, local_time time not null,
  weekdays smallint[] not null default '{0,1,2,3,4}', timezone text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, reminder_type)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(),
  last_success_at timestamptz, disabled_at timestamptz, unique(user_id, endpoint)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type public.reminder_type not null, scheduled_for timestamptz not null, scheduled_local_date date not null,
  scheduled_local_time time not null, status text not null check (status in ('pending','sent','failed','expired')),
  error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, reminder_type, scheduled_local_date, scheduled_local_time)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, action text not null,
  previous_data jsonb, new_data jsonb, reason text, created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(user_id, entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','employment_terms','work_schedule_versions','time_entries','time_adjustments','leave_entries','leave_balance_adjustments','calendar_exceptions','reminder_settings','notification_deliveries'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.normalize_username(value text) returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(trim(normalize(value, NFKC)), '\s+', ' ', 'g'))
$$;

create or replace function public.is_username_available(candidate text) returns boolean language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from public.profiles where normalized_username = public.normalize_username(candidate))
$$;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare raw_name text := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
begin
  insert into public.profiles(id, username, normalized_username) values(new.id, raw_name, public.normalize_username(raw_name));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.prevent_time_entry_overlap() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.time_entries e where e.user_id = new.user_id and e.id <> new.id and e.deleted_at is null
    and tstzrange(e.clock_in, coalesce(e.clock_out, 'infinity'::timestamptz), '[)') && tstzrange(new.clock_in, coalesce(new.clock_out, 'infinity'::timestamptz), '[)'))
  then raise exception 'time_entry_overlap' using errcode = '23P01'; end if;
  return new;
end $$;
create trigger prevent_time_entry_overlap before insert or update of clock_in, clock_out, deleted_at on public.time_entries for each row when (new.deleted_at is null) execute function public.prevent_time_entry_overlap();

create or replace function public.audit_time_entry() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(user_id, entity_type, entity_id, action, previous_data, new_data, reason)
  values(coalesce(new.user_id, old.user_id), 'time_entry', coalesce(new.id, old.id), lower(tg_op), case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end, coalesce(new.edit_reason, old.edit_reason));
  return coalesce(new, old);
end $$;
create trigger audit_time_entries after insert or update or delete on public.time_entries for each row execute function public.audit_time_entry();

create or replace function public.start_clock() returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare result public.time_entries; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.time_entries(user_id, clock_in, source) values(uid, clock_timestamp(), 'clock') returning * into result;
  return result;
end $$;

create or replace function public.stop_clock() returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare result public.time_entries; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.time_entries set clock_out = clock_timestamp() where id = (
    select id from public.time_entries where user_id = uid and clock_out is null and deleted_at is null order by clock_in limit 1 for update skip locked
  ) returning * into result;
  if result.id is null then raise exception 'no_active_clock'; end if;
  return result;
end $$;

create or replace function public.soft_delete_time_entry(entry_id uuid, delete_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.time_entries set deleted_at = now(), edit_reason = delete_reason where id = entry_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'entry_not_found'; end if;
end $$;

create or replace function public.monthly_time_summary(month_start date, month_end date) returns table(work_date date, worked_minutes bigint, first_clock_in timestamptz, last_clock_out timestamptz, sessions bigint)
language sql stable security invoker set search_path = '' as $$
  with days as (select generate_series(month_start, month_end, interval '1 day')::date work_date)
  select d.work_date,
    coalesce(sum(round(extract(epoch from (least(e.clock_out, ((d.work_date + 1)::timestamp at time zone p.timezone)) - greatest(e.clock_in, (d.work_date::timestamp at time zone p.timezone)))) / 60)), 0)::bigint,
    min(e.clock_in), max(e.clock_out), count(e.id)
  from days d cross join public.profiles p
  left join public.time_entries e on e.user_id = p.id and e.deleted_at is null and e.clock_out is not null
    and e.clock_in < ((d.work_date + 1)::timestamp at time zone p.timezone) and e.clock_out > (d.work_date::timestamp at time zone p.timezone)
  where p.id = auth.uid() group by d.work_date order by d.work_date;
$$;

grant execute on function public.start_clock() to authenticated;
grant execute on function public.stop_clock() to authenticated;
grant execute on function public.soft_delete_time_entry(uuid,text) to authenticated;
grant execute on function public.monthly_time_summary(date,date) to authenticated;

alter table public.profiles enable row level security;
alter table public.employment_terms enable row level security;
alter table public.work_schedule_versions enable row level security;
alter table public.work_schedule_days enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_adjustments enable row level security;
alter table public.leave_entries enable row level security;
alter table public.leave_balance_adjustments enable row level security;
alter table public.calendar_exceptions enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_owner on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy terms_owner on public.employment_terms for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy schedules_owner on public.work_schedule_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy schedule_days_owner on public.work_schedule_days for all using (exists(select 1 from public.work_schedule_versions s where s.id = schedule_version_id and s.user_id = auth.uid())) with check (exists(select 1 from public.work_schedule_versions s where s.id = schedule_version_id and s.user_id = auth.uid()));
create policy entries_owner on public.time_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy adjustments_owner on public.time_adjustments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy leave_owner on public.leave_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy leave_balances_owner on public.leave_balance_adjustments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exceptions_owner on public.calendar_exceptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_owner on public.reminder_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_owner on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy deliveries_read_owner on public.notification_deliveries for select using (user_id = auth.uid());
create policy audits_read_owner on public.audit_logs for select using (user_id = auth.uid());

alter publication supabase_realtime add table public.time_entries;
commit;
