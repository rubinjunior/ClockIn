begin;

update public.profiles set timezone = 'Asia/Jerusalem', locale = 'he-IL' where timezone <> 'Asia/Jerusalem' or locale <> 'he-IL';
update public.reminder_settings set timezone = 'Asia/Jerusalem' where timezone <> 'Asia/Jerusalem';

create or replace function public.reject_future_time_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clock_in > clock_timestamp() + interval '1 minute'
    or (new.clock_out is not null and new.clock_out > clock_timestamp() + interval '1 minute') then
    raise exception 'future_time_entry_not_allowed' using errcode = '22007';
  end if;
  return new;
end $$;

drop trigger if exists reject_future_time_entry on public.time_entries;
create trigger reject_future_time_entry
before insert or update of clock_in, clock_out on public.time_entries
for each row execute function public.reject_future_time_entry();

create or replace function public.prevent_leave_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and exists (
    select 1 from public.leave_entries existing
    where existing.user_id = new.user_id
      and existing.status = 'approved'
      and existing.id is distinct from new.id
      and daterange(existing.start_date, existing.end_date + 1, '[)') && daterange(new.start_date, new.end_date + 1, '[)')
  ) then
    raise exception 'leave_entry_overlap' using errcode = '23P01';
  end if;
  return new;
end $$;

drop trigger if exists prevent_leave_overlap on public.leave_entries;
create trigger prevent_leave_overlap
before insert or update of start_date, end_date, status on public.leave_entries
for each row execute function public.prevent_leave_overlap();
create or replace function public.create_work_schedule(
  schedule_name text,
  starts_on date,
  start_at time,
  end_at time,
  workdays smallint[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_start date;
  target integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if schedule_name is null or char_length(trim(schedule_name)) not between 2 and 80 then raise exception 'invalid_schedule_name' using errcode = '22023'; end if;
  if starts_on is null or start_at is null or end_at is null or end_at <= start_at then raise exception 'invalid_schedule_time' using errcode = '22023'; end if;
  if workdays is null or cardinality(workdays) = 0 or exists(select 1 from unnest(workdays) as selected(day) where selected.day not between 0 and 6) then raise exception 'invalid_workdays' using errcode = '22023'; end if;
  target := (extract(epoch from (end_at - start_at)) / 60)::integer;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  delete from public.work_schedule_versions where user_id = uid and effective_from = starts_on;
  select min(effective_from) into next_start from public.work_schedule_versions where user_id = uid and effective_from > starts_on;
  update public.work_schedule_versions
    set effective_to = starts_on - 1
    where user_id = uid and effective_from < starts_on and (effective_to is null or effective_to >= starts_on);

  insert into public.work_schedule_versions(user_id, name, effective_from, effective_to)
  values(uid, trim(schedule_name), starts_on, case when next_start is null then null else next_start - 1 end)
  returning id into new_id;

  insert into public.work_schedule_days(schedule_version_id, weekday, is_workday, expected_start_time, expected_end_time, target_minutes)
  select new_id, generated.day, generated.day = any(workdays), case when generated.day = any(workdays) then start_at end,
    case when generated.day = any(workdays) then end_at end, case when generated.day = any(workdays) then target else 0 end
  from generate_series(0, 6) as generated(day);

  return new_id;
end $$;

create or replace function public.create_employment_term(
  starts_on date,
  compensation_mode public.compensation_mode,
  rate numeric default null,
  salary numeric default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_start date;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if starts_on is null then raise exception 'invalid_start_date' using errcode = '22023'; end if;
  if compensation_mode = 'hourly' and (rate is null or rate < 0) then raise exception 'invalid_hourly_rate' using errcode = '22023'; end if;
  if compensation_mode = 'global' and (salary is null or salary < 0) then raise exception 'invalid_monthly_salary' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 1));

  delete from public.employment_terms where user_id = uid and effective_from = starts_on;
  select min(effective_from) into next_start from public.employment_terms where user_id = uid and effective_from > starts_on;
  update public.employment_terms
    set effective_to = starts_on - 1
    where user_id = uid and effective_from < starts_on and (effective_to is null or effective_to >= starts_on);

  insert into public.employment_terms(user_id, effective_from, effective_to, compensation_enabled, mode, hourly_rate, monthly_salary, currency)
  values(uid, starts_on, case when next_start is null then null else next_start - 1 end, compensation_mode <> 'hidden', compensation_mode,
    case when compensation_mode = 'hourly' then rate end, case when compensation_mode = 'global' then salary end, 'ILS')
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.create_work_schedule(text,date,time,time,smallint[]) from public, anon;
grant execute on function public.create_work_schedule(text,date,time,time,smallint[]) to authenticated;
revoke all on function public.create_employment_term(date,public.compensation_mode,numeric,numeric) from public, anon;
grant execute on function public.create_employment_term(date,public.compensation_mode,numeric,numeric) to authenticated;

create or replace function public.monthly_report(month_start date, month_end date, include_future boolean default false)
returns table(
  work_date date, expected_minutes integer, worked_minutes bigint, credited_absence_minutes integer,
  manual_adjustment_minutes bigint, final_balance_minutes bigint, missing_minutes bigint, overtime_minutes bigint,
  first_clock_in timestamptz, last_clock_out timestamptz, sessions bigint, holiday_label text, shortened_day boolean, provisional boolean
)
language sql stable security invoker set search_path = '' as $$
with days as (
  select generate_series(month_start, month_end, interval '1 day')::date as work_date
), context as (
  select d.work_date, p.id user_id, p.timezone,
    coalesce(case
      when ce.exception_type in ('holiday','day_off') then 0
      when ce.exception_type in ('shortened','special_workday') then ce.target_minutes
      else sd.target_minutes end, 0)::integer expected,
    ce.name holiday_label, ce.exception_type = 'shortened' shortened_day
  from days d join public.profiles p on p.id = auth.uid()
  left join lateral (
    select v.id from public.work_schedule_versions v where v.user_id=p.id and v.effective_from<=d.work_date and (v.effective_to is null or v.effective_to>=d.work_date) order by v.effective_from desc limit 1
  ) active_schedule on true
  left join public.work_schedule_days sd on sd.schedule_version_id=active_schedule.id and sd.weekday=extract(dow from d.work_date)::integer and sd.is_workday
  left join public.calendar_exceptions ce on ce.user_id=p.id and (ce.exception_date=d.work_date or (ce.annually_recurring and to_char(ce.exception_date,'MM-DD')=to_char(d.work_date,'MM-DD')))
), worked as (
  select c.work_date,
    coalesce(sum(round(extract(epoch from (least(e.clock_out, ((c.work_date + 1)::timestamp at time zone c.timezone)) - greatest(e.clock_in, (c.work_date::timestamp at time zone c.timezone)))) / 60)),0)::bigint worked_minutes,
    min(e.clock_in) first_clock_in, max(e.clock_out) last_clock_out, count(e.id)::bigint sessions
  from context c left join public.time_entries e on e.user_id=c.user_id and e.deleted_at is null and e.clock_out is not null
    and e.clock_in <= now() and e.clock_out <= now()
    and e.clock_in < ((c.work_date+1)::timestamp at time zone c.timezone) and e.clock_out > (c.work_date::timestamp at time zone c.timezone)
  group by c.work_date
), leave_credit as (
  select c.work_date, least(c.expected, coalesce(max(case when l.partial_minutes is null then c.expected else l.partial_minutes end),0))::integer credited
  from context c left join public.leave_entries l on l.user_id=c.user_id and l.status='approved' and c.work_date between l.start_date and l.end_date group by c.work_date,c.expected
), adjustments as (
  select c.work_date, coalesce(sum(a.minutes),0)::bigint minutes from context c left join public.time_adjustments a on a.user_id=c.user_id and a.adjustment_date=c.work_date group by c.work_date
), assembled as (
  select c.*, w.worked_minutes, l.credited, a.minutes adjustment, w.first_clock_in,w.last_clock_out,w.sessions,
    (w.worked_minutes+l.credited+a.minutes-c.expected)::bigint balance,
    c.work_date > (now() at time zone c.timezone)::date is_future
  from context c join worked w using(work_date) join leave_credit l using(work_date) join adjustments a using(work_date)
)
select work_date,
  case when is_future and not include_future then 0 else expected end,
  case when is_future then 0 else worked_minutes end,
  case when is_future then 0 else credited end,
  case when is_future then 0 else adjustment end,
  case when is_future then 0 else balance end,
  case when is_future then 0 else greatest(0,-balance) end,
  case when is_future then 0 else greatest(0,balance) end,
  case when is_future then null else first_clock_in end,
  case when is_future then null else last_clock_out end,
  case when is_future then 0 else sessions end,
  holiday_label, shortened_day,
  work_date=(now() at time zone timezone)::date
from assembled order by work_date;
$$;

grant execute on function public.monthly_report(date,date,boolean) to authenticated;

commit;