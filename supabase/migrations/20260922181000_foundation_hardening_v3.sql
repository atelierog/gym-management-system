-- GymOS foundation hardening v3
-- Applied to production on 2026-09-22.
begin;

alter table public.gyms
  add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.gyms drop constraint if exists gyms_timezone_chk;
alter table public.gyms add constraint gyms_timezone_chk check (char_length(timezone) between 3 and 64);

update public.membership_plans
set name = initcap(duration_value::text || ' ' || case when duration_unit='day' then 'day' else 'month' end)
where name is null or btrim(name) = '' or name = 'Gym';

delete from public.membership_plans a
using public.membership_plans b
where a.id > b.id
  and a.gym_id=b.gym_id
  and a.duration_unit=b.duration_unit
  and a.duration_value=b.duration_value
  and not exists (select 1 from public.memberships m where m.plan_id=a.id);

create unique index if not exists membership_plans_gym_duration_unique
  on public.membership_plans(gym_id,duration_unit,duration_value);

grant execute on function public.bootstrap_platform_admin() to authenticated;
grant execute on function public.super_admin_update_gym_details(uuid,text,text) to authenticated;
revoke execute on function public.bootstrap_platform_admin() from anon;
revoke execute on function public.super_admin_update_gym_details(uuid,text,text) from anon;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is not null
     and (new.gym_id is distinct from old.gym_id or new.role is distinct from old.role) then
    raise exception 'Protected profile fields cannot be changed from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

create or replace function public.check_in_attendance(p_lat numeric,p_lng numeric)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gym_id uuid;
  v_role text;
  v_lat numeric;
  v_lng numeric;
  v_radius integer;
  v_timezone text;
  v_today date;
  v_distance numeric;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select p.gym_id,p.role into v_gym_id,v_role from public.profiles p where p.id=v_uid and p.status='active';
  if v_gym_id is null then raise exception 'Active account required'; end if;
  if v_role not in ('member','trainer') then raise exception 'Only members and trainers can check in'; end if;
  select latitude,longitude,allowed_radius_m,timezone into v_lat,v_lng,v_radius,v_timezone from public.gyms where id=v_gym_id;
  if v_lat is null or v_lng is null then raise exception 'Gym location is not configured'; end if;
  if p_lat is null or p_lng is null then raise exception 'Location is required'; end if;
  v_today := (now() at time zone coalesce(v_timezone,'Asia/Kolkata'))::date;
  if extract(isodow from (now() at time zone coalesce(v_timezone,'Asia/Kolkata'))) = 7 then raise exception 'Sunday is a gym holiday'; end if;
  if v_role='member' and not exists (
    select 1 from public.memberships m where m.member_id=v_uid and m.gym_id=v_gym_id
      and m.status='active' and m.start_date<=v_today and m.expiry_date>=v_today
  ) then raise exception 'Active membership required'; end if;
  if exists (
    select 1 from public.attendance a where a.user_id=v_uid and a.gym_id=v_gym_id
      and (a.check_in at time zone coalesce(v_timezone,'Asia/Kolkata'))::date=v_today
      and a.check_out is null
  ) then raise exception 'Already checked in'; end if;
  v_distance := 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_lat-v_lat)/2),2) +
    cos(radians(v_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-v_lng)/2),2)
  ));
  if v_distance > v_radius then raise exception 'You are outside the gym check-in area'; end if;
  insert into public.attendance(gym_id,user_id,check_in,check_in_lat,check_in_lng,status)
  values(v_gym_id,v_uid,now(),p_lat,p_lng,'present')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.check_in_attendance(numeric,numeric) from public,anon;
grant execute on function public.check_in_attendance(numeric,numeric) to authenticated;
revoke insert on public.attendance from authenticated;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
using (gym_id=(select private.current_gym_id()) and
       (member_id=(select auth.uid()) or (select private.current_role())='admin'));

drop policy if exists gyms_select on public.gyms;
drop policy if exists profiles_select on public.profiles;

drop policy if exists platform_admin_self_insert on public.platform_admins;
create policy platform_admin_self_insert on public.platform_admins
for insert to authenticated
with check (
  id=(select auth.uid())
  and lower(email)=lower(coalesce((select auth.jwt()->>'email'),''))
  and lower(email)='atelierog.co@gmail.com'
  and status='active'
);

create or replace function public.assign_membership(
  p_member_id uuid,p_plan_id uuid,p_start_date date,
  p_payment_status text default 'paid',p_due_date date default null,p_method text default null
)
returns uuid language plpgsql set search_path=''
as $$
declare
  v_gym uuid := (select private.current_gym_id());
  v_uid uuid := (select auth.uid());
  v_expiry date; v_amount numeric; v_value integer; v_unit text; v_membership uuid; v_receipt text;
begin
  if v_uid is null or (select private.current_role()) <> 'admin' then raise exception 'Only gym admins can assign memberships'; end if;
  if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
  if p_payment_status='paid' and p_method not in ('cash','upi','card','bank_transfer') then raise exception 'Payment method is required'; end if;
  if p_payment_status='pending' and p_due_date is null then raise exception 'Due date is required'; end if;
  select duration_value,duration_unit,price into v_value,v_unit,v_amount from public.membership_plans where id=p_plan_id and gym_id=v_gym and active=true;
  if v_value is null then raise exception 'Membership plan not found'; end if;
  if v_unit='day' then v_expiry:=p_start_date+v_value; else v_expiry:=(p_start_date+make_interval(months=>v_value))::date; end if;
  if not exists(select 1 from public.profiles where id=p_member_id and gym_id=v_gym and role='member') then raise exception 'Member not found in this gym'; end if;
  if exists(select 1 from public.memberships where gym_id=v_gym and member_id=p_member_id and status='active') then raise exception 'Member already has an active membership. Use Renew instead.'; end if;
  insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status,payment_status,amount_paid,amount_due,due_date)
  values(v_gym,p_member_id,p_plan_id,p_start_date,v_expiry,v_amount,'active',
    case when p_payment_status='paid' then 'paid' else 'pending' end,
    case when p_payment_status='paid' then v_amount else 0 end,
    case when p_payment_status='paid' then 0 else v_amount end,
    case when p_payment_status='pending' then p_due_date else null end)
  returning id into v_membership;
  if p_payment_status='paid' then
    v_receipt:='R'||right(extract(epoch from clock_timestamp())::bigint::text,9);
    insert into public.payments(gym_id,member_id,membership_id,receipt_no,amount,method)
    values(v_gym,p_member_id,v_membership,v_receipt,v_amount,p_method);
  end if;
  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym,v_uid,'assign_membership','membership',v_membership,
    jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount,'payment_status',p_payment_status));
  return v_membership;
end;
$$;
revoke execute on function public.assign_membership(uuid,uuid,date,text,date,text) from public,anon;
grant execute on function public.assign_membership(uuid,uuid,date,text,date,text) to authenticated;

create or replace function public.renew_membership_v2(
  p_member_id uuid,p_plan_id uuid,p_start_date date,
  p_payment_status text default 'paid',p_due_date date default null,p_method text default null
)
returns uuid language plpgsql set search_path=''
as $$
declare
  v_gym uuid := (select private.current_gym_id());
  v_uid uuid := (select auth.uid());
  v_expiry date; v_amount numeric; v_value integer; v_unit text; v_membership uuid; v_receipt text;
begin
  if v_uid is null or (select private.current_role()) <> 'admin' then raise exception 'Only gym admins can renew memberships'; end if;
  if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
  if p_payment_status='paid' and p_method not in ('cash','upi','card','bank_transfer') then raise exception 'Payment method is required'; end if;
  if p_payment_status='pending' and p_due_date is null then raise exception 'Due date is required'; end if;
  select duration_value,duration_unit,price into v_value,v_unit,v_amount from public.membership_plans where id=p_plan_id and gym_id=v_gym and active=true;
  if v_value is null then raise exception 'Membership plan not found'; end if;
  if not exists(select 1 from public.profiles where id=p_member_id and gym_id=v_gym and role='member') then raise exception 'Member not found in this gym'; end if;
  if v_unit='day' then v_expiry:=p_start_date+v_value; else v_expiry:=(p_start_date+make_interval(months=>v_value))::date; end if;
  update public.memberships set status='expired' where gym_id=v_gym and member_id=p_member_id and status='active';
  insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status,payment_status,amount_paid,amount_due,due_date)
  values(v_gym,p_member_id,p_plan_id,p_start_date,v_expiry,v_amount,'active',
    case when p_payment_status='paid' then 'paid' else 'pending' end,
    case when p_payment_status='paid' then v_amount else 0 end,
    case when p_payment_status='paid' then 0 else v_amount end,
    case when p_payment_status='pending' then p_due_date else null end)
  returning id into v_membership;
  if p_payment_status='paid' then
    v_receipt:='R'||right(extract(epoch from clock_timestamp())::bigint::text,9);
    insert into public.payments(gym_id,member_id,membership_id,receipt_no,amount,method)
    values(v_gym,p_member_id,v_membership,v_receipt,v_amount,p_method);
  end if;
  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym,v_uid,'renew_membership','membership',v_membership,
    jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount,'payment_status',p_payment_status));
  return v_membership;
end;
$$;
revoke execute on function public.renew_membership_v2(uuid,uuid,date,text,date,text) from public,anon;
grant execute on function public.renew_membership_v2(uuid,uuid,date,text,date,text) to authenticated;

commit;
