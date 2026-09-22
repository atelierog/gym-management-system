-- GymOS V1 hardening migration: keep this file as the production database change record.
-- Applied to Supabase project kwzdxqhzhnmrjfyhgzxa on 2026-09-22.
-- Includes attendance checkout hardening, tenant-safe payment/membership policies,
-- audit logging, constraints, and scheduled automation functions.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

alter table public.profiles add column if not exists phone text;
alter table public.gyms add column if not exists auto_checkout_enabled boolean not null default true;
alter table public.gyms add column if not exists auto_checkout_minutes integer not null default 180;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='gyms_radius_chk') then alter table public.gyms add constraint gyms_radius_chk check (allowed_radius_m between 10 and 5000); end if;
  if not exists (select 1 from pg_constraint where conname='gyms_auto_checkout_minutes_chk') then alter table public.gyms add constraint gyms_auto_checkout_minutes_chk check (auto_checkout_minutes between 15 and 1440); end if;
  if not exists (select 1 from pg_constraint where conname='membership_plans_duration_chk') then alter table public.membership_plans add constraint membership_plans_duration_chk check (duration_months in (1,3,6,12)); end if;
  if not exists (select 1 from pg_constraint where conname='memberships_dates_chk') then alter table public.memberships add constraint memberships_dates_chk check (expiry_date >= start_date); end if;
  if not exists (select 1 from pg_constraint where conname='attendance_checkout_time_chk') then alter table public.attendance add constraint attendance_checkout_time_chk check (check_out is null or check_out >= check_in); end if;
end $$;

create unique index if not exists attendance_one_open_per_user_idx on public.attendance(user_id) where check_out is null;
create unique index if not exists memberships_one_active_per_member_idx on public.memberships(gym_id,member_id) where status='active';
create index if not exists attendance_gym_checkin_idx on public.attendance(gym_id,check_in);
create index if not exists attendance_gym_user_checkin_idx on public.attendance(gym_id,user_id,check_in desc);
create index if not exists memberships_gym_expiry_idx on public.memberships(gym_id,expiry_date);
create index if not exists memberships_gym_member_idx on public.memberships(gym_id,member_id,expiry_date desc);
create index if not exists payments_gym_paid_idx on public.payments(gym_id,paid_at);
create index if not exists payments_gym_member_idx on public.payments(gym_id,member_id,paid_at desc);
create index if not exists audit_logs_gym_actor_idx on public.audit_logs(gym_id,actor_id,created_at desc);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (memberships.payments.gym_id=(select private.current_gym_id()) and (select private.current_role())='admin' and id <> (select auth.uid()))
with check (gym_id=(select private.current_gym_id()));

drop policy if exists attendance_update_self on public.attendance;
revoke update on public.attendance from authenticated;

create or replace function private.manual_checkout_attendance(p_attendance_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.attendance
  set check_out=now(),checkout_type='manual',status='present'
  where public.attendance.id=p_attendance_id
    and public.attendance.user_id=auth.uid()
    and public.attendance.gym_id=(select private.current_gym_id())
    and public.attendance.check_out is null
  returning public.attendance.id into v_id;
  if v_id is null then raise exception 'Open attendance record not found'; end if;
  return v_id;
end $;
revoke all on function private.manual_checkout_attendance(uuid) from public;
grant execute on function private.manual_checkout_attendance(uuid) to authenticated;

create or replace function public.manual_checkout_attendance(p_attendance_id uuid)
returns uuid language sql security invoker set search_path=''
as $ select private.manual_checkout_attendance(p_attendance_id) $;
revoke all on function public.manual_checkout_attendance(uuid) from public;
grant execute on function public.manual_checkout_attendance(uuid) to authenticated;

drop policy if exists audit_insert_self on public.audit_logs;
create policy audit_insert_self on public.audit_logs for insert to authenticated
with check(gym_id=(select private.current_gym_id()) and actor_id=(select auth.uid()));

create or replace function public.record_audit(p_action text,p_entity text default null,p_entity_id uuid default null,p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path=''
as $
declare v_id uuid; v_gym uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_gym := (select private.current_gym_id());
  if v_gym is null then raise exception 'Gym profile not found'; end if;
  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym,auth.uid(),p_action,p_entity,p_entity_id,coalesce(p_details,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $;
revoke all on function public.record_audit(text,text,uuid,jsonb) from public;
grant execute on function public.record_audit(text,text,uuid,jsonb) to authenticated;

drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs for select to authenticated
using(gym_id=(select private.current_gym_id()) and (select private.current_role())='admin');

drop policy if exists memberships_admin_insert on public.memberships;
create policy memberships_admin_insert on public.memberships for insert to authenticated
with check (
  gym_id=(select private.current_gym_id()) and (select private.current_role())='admin'
  and exists(select 1 from public.profiles p where p.id=memberships.member_id and p.gym_id=memberships.gym_id and p.role='member')
  and (plan_id is null or exists(select 1 from public.membership_plans mp where mp.id=memberships.plan_id and mp.gym_id=memberships.gym_id))
);

drop policy if exists memberships_admin_update on public.memberships;
create policy memberships_admin_update on public.memberships for update to authenticated
using(gym_id=(select private.current_gym_id()) and (select private.current_role())='admin')
with check (
  gym_id=(select private.current_gym_id()) and (select private.current_role())='admin'
  and exists(select 1 from public.profiles p where p.id=payments.member_id and p.gym_id=payments.gym_id and p.role='member')
  and (plan_id is null or exists(select 1 from public.membership_plans mp where mp.id=plan_id and mp.gym_id=gym_id))
);

drop policy if exists payments_admin_insert on public.payments;
create policy payments_admin_insert on public.payments for insert to authenticated
with check (
  gym_id=(select private.current_gym_id()) and (select private.current_role())='admin'
  and exists(select 1 from public.profiles p where p.id=member_id and p.gym_id=gym_id and p.role='member')
  and (membership_id is null or exists(select 1 from public.memberships m where m.id=payments.membership_id and m.gym_id=payments.gym_id and m.member_id=payments.member_id))
);

drop policy if exists payments_admin_update on public.payments;
create policy payments_admin_update on public.payments for update to authenticated
using(gym_id=(select private.current_gym_id()) and (select private.current_role())='admin')
with check (
  gym_id=(select private.current_gym_id()) and (select private.current_role())='admin'
  and exists(select 1 from public.profiles p where p.id=member_id and p.gym_id=gym_id and p.role='member')
  and (membership_id is null or exists(select 1 from public.memberships m where m.id=membership_id and m.gym_id=gym_id and m.member_id=member_id))
);

create or replace function private.current_gym_id()
returns uuid language sql stable security definer set search_path=''
as $$ select public.profiles.gym_id from public.profiles where public.profiles.id=(select auth.uid()) $$;
revoke all on function private.current_gym_id() from public;
grant execute on function private.current_gym_id() to authenticated;

create or replace function private.current_role()
returns text language sql stable security definer set search_path=''
as $$ select public.profiles.role from public.profiles where public.profiles.id=(select auth.uid()) $$;
revoke all on function private.current_role() from public;
grant execute on function private.current_role() to authenticated;

create or replace function public.auto_checkout_attendance()
returns integer language plpgsql security definer set search_path=''
as $$
declare changed integer;
begin
  update public.attendance a
  set check_out=a.check_in + make_interval(mins=>g.auto_checkout_minutes),checkout_type='system_auto',status='present'
  from public.gyms g
  where a.gym_id=g.id and g.auto_checkout_enabled=true and a.check_out is null
    and a.check_in <= now()-make_interval(mins=>g.auto_checkout_minutes);
  get diagnostics changed=row_count;
  return changed;
end $$;
revoke all on function public.auto_checkout_attendance() from public;
grant execute on function public.auto_checkout_attendance() to service_role;

create or replace function public.process_membership_expiry_notifications()
returns integer language plpgsql security definer set search_path=''
as $$
declare created_count integer;
begin
  update public.memberships set status='expired' where status='active' and expiry_date < current_date;
  insert into public.notifications(gym_id,user_id,type,message,scheduled_for)
  select m.gym_id,m.member_id,'membership_expiry','Your gym membership expires tomorrow. Please contact the gym for renewal.',current_date
  from public.memberships m where m.status='active' and m.expiry_date=current_date+1
  on conflict(user_id,type,scheduled_for) do nothing;
  get diagnostics created_count=row_count;
  return created_count;
end $$;
revoke all on function public.process_membership_expiry_notifications() from public;
grant execute on function public.process_membership_expiry_notifications() to service_role;

create or replace function public.renew_membership(p_member_id uuid,p_plan_id uuid,p_start_date date,p_amount numeric default null)
returns uuid language plpgsql set search_path=''
as $$
declare v_gym_id uuid; v_months integer; v_amount numeric; v_id uuid;
begin
  if auth.uid() is null or (select private.current_role()) <> 'admin' then raise exception 'Only gym admins can renew memberships'; end if;
  select p.gym_id into v_gym_id from public.profiles p where p.id=p_member_id and p.role='member' and p.gym_id=(select private.current_gym_id());
  if v_gym_id is null then raise exception 'Member not found in this gym'; end if;
  select mp.duration_months,mp.price into v_months,v_amount from public.membership_plans mp where mp.id=p_plan_id and mp.gym_id=v_gym_id and mp.active=true;
  if v_months is null then raise exception 'Membership plan not found'; end if;
  v_amount:=coalesce(p_amount,v_amount);
  update public.memberships m set status='expired' where m.gym_id=v_gym_id and m.member_id=p_member_id and m.status='active';
  insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status)
  values(v_gym_id,p_member_id,p_plan_id,p_start_date,(p_start_date+make_interval(months=>v_months))::date,v_amount,'active')
  returning id into v_id;
  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym_id,auth.uid(),'renew_membership','membership',v_id,jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount));
  return v_id;
end $$;
revoke execute on function public.renew_membership(uuid,uuid,date,numeric) from public;
grant execute on function public.renew_membership(uuid,uuid,date,numeric) to authenticated;
