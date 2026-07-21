-- Seed after creating a development auth user. Replace only this local placeholder.
do $$
declare uid uuid := (select id from auth.users order by created_at limit 1);
declare schedule_id uuid;
begin
  if uid is null then raise notice 'Create a local auth user before running seed.sql'; return; end if;
  update public.profiles set username = 'משתמש לדוגמה', normalized_username = 'משתמש לדוגמה', full_name = 'דוגמה', onboarding_completed_at = now() where id = uid;
  insert into public.work_schedule_versions(user_id,name,effective_from) values(uid,'שגרה רגילה',current_date - 365) returning id into schedule_id;
  insert into public.work_schedule_days(schedule_version_id,weekday,is_workday,expected_start_time,expected_end_time,target_minutes)
  select schedule_id, day, day between 0 and 4, case when day between 0 and 4 then '08:30'::time end, case when day between 0 and 4 then '17:00'::time end, case when day between 0 and 4 then 510 else 0 end from generate_series(0,6) day;
  insert into public.employment_terms(user_id,effective_from,compensation_enabled,mode,hourly_rate) values(uid,current_date - 365,true,'hourly',62.50);
  insert into public.time_entries(user_id,clock_in,clock_out,source) values(uid,now()-interval '2 days 8 hours',now()-interval '2 days','clock'),(uid,now()-interval '1 day 9 hours',now()-interval '1 day','clock');
  insert into public.leave_entries(user_id,leave_type,start_date,end_date,status) values(uid,'vacation',current_date-10,current_date-10,'approved'),(uid,'sick',current_date-20,current_date-20,'approved');
  insert into public.calendar_exceptions(user_id,exception_date,exception_type,name,target_minutes) values(uid,current_date-5,'shortened','יום מקוצר לדוגמה',300);
  insert into public.time_adjustments(user_id,adjustment_date,minutes,reason) values(uid,current_date-3,30,'התאמת שעות לדוגמה');
  insert into public.reminder_settings(user_id,reminder_type,enabled,local_time) values(uid,'clock_in',true,'08:25'),(uid,'clock_out',true,'17:05');
end $$;
