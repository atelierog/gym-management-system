alter table public.profiles add column if not exists email text;
create index if not exists profiles_gym_email_idx on public.profiles(gym_id,email);

update public.membership_plans
set name = case duration_months when 1 then '1 Month' when 3 then '3 Months' when 6 then '6 Months' when 12 then '12 Months' else duration_months::text || ' Months' end;

create unique index if not exists membership_plans_gym_duration_uidx
on public.membership_plans(gym_id,duration_months);

alter table public.membership_plans drop constraint if exists membership_plans_duration_months_check;
alter table public.membership_plans
add constraint membership_plans_duration_months_check check (duration_months in (1,3,6,12));