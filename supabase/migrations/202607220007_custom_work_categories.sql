begin;

create table public.work_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40 and name = trim(name)),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index work_categories_user_name_unique
  on public.work_categories(user_id, lower(name));

alter table public.time_entries
  add column category_id uuid,
  add constraint time_entries_category_owner_fk
    foreign key (user_id, category_id)
    references public.work_categories(user_id, id)
    on update cascade
    on delete restrict;

create index time_entries_category_idx
  on public.time_entries(user_id, category_id, clock_in)
  where deleted_at is null and category_id is not null;

create trigger set_updated_at
  before update on public.work_categories
  for each row execute function public.set_updated_at();

alter table public.work_categories enable row level security;

create policy work_categories_owner
  on public.work_categories
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.work_categories to authenticated;
revoke all on table public.work_categories from anon;
grant all privileges on table public.work_categories to service_role;

create or replace function public.monthly_category_summary(month_start date, month_end date)
returns table(category_id uuid, category_name text, minutes bigint)
language sql stable security invoker set search_path = '' as $$
  with profile as (
    select id, timezone from public.profiles where id = auth.uid()
  ), boundaries as (
    select
      (month_start::timestamp at time zone timezone) as starts_at,
      ((month_end + 1)::timestamp at time zone timezone) as ends_at
    from profile
  ), totals as (
    select e.category_id,
      coalesce(sum(round(extract(epoch from (
        least(e.clock_out, b.ends_at) - greatest(e.clock_in, b.starts_at)
      )) / 60)), 0)::bigint as minutes
    from public.time_entries e
    cross join boundaries b
    where e.user_id = auth.uid()
      and e.category_id is not null
      and e.deleted_at is null
      and e.clock_out is not null
      and e.clock_in < b.ends_at
      and e.clock_out > b.starts_at
    group by e.category_id
  )
  select c.id, c.name, coalesce(t.minutes, 0)
  from public.work_categories c
  left join totals t on t.category_id = c.id
  where c.user_id = auth.uid()
    and (c.is_active or coalesce(t.minutes, 0) > 0)
  order by c.sort_order, c.created_at;
$$;

grant execute on function public.monthly_category_summary(date, date) to authenticated;

commit;