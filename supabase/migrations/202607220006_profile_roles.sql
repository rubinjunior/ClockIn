begin;

do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists role public.app_role not null default 'user';

update public.profiles as profile
set role = 'admin'
from auth.users as account
where account.id = profile.id
  and lower(account.email) = 'ori.ru@rubinproj.co.il';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  assigned_role public.app_role := case
    when lower(new.email) = 'ori.ru@rubinproj.co.il' then 'admin'::public.app_role
    else 'user'::public.app_role
  end;
begin
  insert into public.profiles(id, username, normalized_username, role)
  values(new.id, raw_name, public.normalize_username(raw_name), assigned_role);
  return new;
end $$;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'role_change_not_allowed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update of role on public.profiles
for each row execute function public.prevent_profile_role_change();

revoke update on table public.profiles from authenticated;
grant update (username, normalized_username, full_name, timezone, locale, onboarding_completed_at)
on table public.profiles to authenticated;

commit;