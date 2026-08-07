begin;

drop trigger if exists prevent_time_entry_overlap on public.time_entries;
drop function if exists public.prevent_time_entry_overlap();

create or replace function public.reject_future_time_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today_in_israel date := (clock_timestamp() at time zone 'Asia/Jerusalem')::date;
begin
  if (new.clock_in at time zone 'Asia/Jerusalem')::date > today_in_israel
    or (new.clock_out is not null and (new.clock_out at time zone 'Asia/Jerusalem')::date > today_in_israel) then
    raise exception 'future_time_entry_not_allowed' using errcode = '22007';
  end if;
  return new;
end $$;

commit;
