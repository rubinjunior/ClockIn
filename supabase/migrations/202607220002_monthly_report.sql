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
    and e.clock_in < ((c.work_date+1)::timestamp at time zone c.timezone) and e.clock_out > (c.work_date::timestamp at time zone c.timezone)
  group by c.work_date
), leave_credit as (
  select c.work_date, least(c.expected, coalesce(max(case when l.partial_minutes is null then c.expected else l.partial_minutes end),0))::integer credited
  from context c left join public.leave_entries l on l.user_id=c.user_id and l.status='approved' and c.work_date between l.start_date and l.end_date group by c.work_date,c.expected
), adjustments as (
  select c.work_date, coalesce(sum(a.minutes),0)::bigint minutes from context c left join public.time_adjustments a on a.user_id=c.user_id and a.adjustment_date=c.work_date group by c.work_date
), assembled as (
  select c.*, w.worked_minutes, l.credited, a.minutes adjustment, w.first_clock_in,w.last_clock_out,w.sessions,
    (w.worked_minutes+l.credited+a.minutes-c.expected)::bigint balance
  from context c join worked w using(work_date) join leave_credit l using(work_date) join adjustments a using(work_date)
)
select work_date, expected, worked_minutes, credited, adjustment, balance,
  case when not include_future and work_date > (now() at time zone timezone)::date then 0 else greatest(0,-balance) end,
  greatest(0,balance), first_clock_in,last_clock_out,sessions,holiday_label,shortened_day,
  work_date=(now() at time zone timezone)::date
from assembled order by work_date;
$$;

grant execute on function public.monthly_report(date,date,boolean) to authenticated;
