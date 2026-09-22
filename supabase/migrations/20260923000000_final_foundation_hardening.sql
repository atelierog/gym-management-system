-- Final foundation hardening.
-- Public RPCs are SECURITY INVOKER wrappers; privileged implementations live in
-- the non-exposed private schema.

begin;

create schema if not exists private;

create or replace function private.bootstrap_platform_admin()
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if v_uid is null or v_email <> 'atelierog.co@gmail.com' then raise exception 'Super Admin access required'; end if;
  insert into public.platform_admins(id,email,full_name,status)
  values(v_uid,v_email,'Atelier OG Super Admin','active')
  on conflict (id) do update set email=excluded.email,status='active';
  return true;
end;
$function$;

create or replace function public.bootstrap_platform_admin()
returns boolean language sql security invoker set search_path=''
as $function$ select private.bootstrap_platform_admin(); $function$;

create or replace function private.super_admin_update_gym_details(p_gym_id uuid,p_phone text default null,p_platform_plan text default null)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if not private.is_super_admin() then raise exception 'Super Admin access required'; end if;
  update public.gyms set platform_plan=coalesce(nullif(trim(p_platform_plan),''),platform_plan) where id=p_gym_id;
  update public.profiles set phone=case when p_phone is null then phone else nullif(trim(p_phone),'') end where gym_id=p_gym_id and role='admin';
  return found;
end;
$function$;

create or replace function public.super_admin_update_gym_details(p_gym_id uuid,p_phone text default null,p_platform_plan text default null)
returns boolean language sql security invoker set search_path=''
as $function$ select private.super_admin_update_gym_details(p_gym_id,p_phone,p_platform_plan); $function$;

drop policy if exists "attendance_insert_self" on public.attendance;
create policy "attendance_insert_admin_only" on public.attendance
for insert to authenticated
with check (gym_id=(select private.current_gym_id()) and (select private.current_role())='admin');

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update to authenticated
using (gym_id=(select private.current_gym_id()) and (select private.current_role())='admin' and id<>(select auth.uid()))
with check (gym_id=(select private.current_gym_id()) and (select private.current_role())='admin' and role in ('member','trainer'));

create or replace function private.assign_membership_v2(
  p_member_id uuid,p_plan_id uuid,p_start_date date,p_payment_status text default 'paid',p_due_date date default null,p_method text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_gym uuid:=(select private.current_gym_id());v_uid uuid:=auth.uid();v_value integer;v_unit text;v_amount numeric;v_expiry date;v_membership uuid;v_receipt text;
begin
 if v_uid is null or (select private.current_role())<>'admin' then raise exception 'Only gym admins can assign memberships'; end if;
 if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
 if p_payment_status='paid' and p_method not in ('cash','upi','card','bank_transfer') then raise exception 'Payment method is required'; end if;
 if p_payment_status='pending' and p_due_date is null then raise exception 'Due date is required'; end if;
 select duration_value,duration_unit,price into v_value,v_unit,v_amount from public.membership_plans where id=p_plan_id and gym_id=v_gym and active=true;
 if v_value is null then raise exception 'Membership plan not found'; end if;
 if not exists(select 1 from public.profiles where id=p_member_id and gym_id=v_gym and role='member') then raise exception 'Member not found in this gym'; end if;
 if v_unit='day' then v_expiry:=p_start_date+v_value; else v_expiry:=(p_start_date+make_interval(months=>v_value))::date; end if;
 update public.memberships set status='expired' where gym_id=v_gym and member_id=p_member_id and status='active';
 insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status,payment_status,amount_paid,amount_due,due_date)
 values(v_gym,p_member_id,p_plan_id,p_start_date,v_expiry,v_amount,'active',case when p_payment_status='paid' then 'paid' else 'pending' end,case when p_payment_status='paid' then v_amount else 0 end,case when p_payment_status='paid' then 0 else v_amount end,case when p_payment_status='pending' then p_due_date else null end) returning id into v_membership;
 if p_payment_status='paid' then v_receipt:='R'||right(extract(epoch from clock_timestamp())::bigint::text,9);insert into public.payments(gym_id,member_id,membership_id,receipt_no,amount,method) values(v_gym,p_member_id,v_membership,v_receipt,v_amount,p_method);end if;
 insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details) values(v_gym,v_uid,'assign_membership','membership',v_membership,jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount,'payment_status',p_payment_status));
 return v_membership;
end;$function$;

create or replace function public.assign_membership_v2(p_member_id uuid,p_plan_id uuid,p_start_date date,p_payment_status text default 'paid',p_due_date date default null,p_method text default null)
returns uuid language sql security invoker set search_path='' as $function$ select private.assign_membership_v2(p_member_id,p_plan_id,p_start_date,p_payment_status,p_due_date,p_method); $function$;

create or replace function private.renew_membership_v2(p_member_id uuid,p_plan_id uuid,p_start_date date,p_payment_status text default 'paid',p_due_date date default null,p_method text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_gym uuid:=(select private.current_gym_id());v_uid uuid:=auth.uid();v_expiry date;v_amount numeric;v_value integer;v_unit text;v_membership uuid;v_receipt text;
begin
 if v_uid is null or (select private.current_role())<>'admin' then raise exception 'Only gym admins can renew memberships'; end if;
 if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
 if p_payment_status='paid' and p_method not in ('cash','upi','card','bank_transfer') then raise exception 'Payment method is required'; end if;
 if p_payment_status='pending' and p_due_date is null then raise exception 'Due date is required'; end if;
 select duration_value,duration_unit,price into v_value,v_unit,v_amount from public.membership_plans where id=p_plan_id and gym_id=v_gym and active=true;
 if v_value is null then raise exception 'Membership plan not found'; end if;
 if not exists(select 1 from public.profiles where id=p_member_id and gym_id=v_gym and role='member') then raise exception 'Member not found in this gym'; end if;
 if v_unit='day' then v_expiry:=p_start_date+v_value; else v_expiry:=(p_start_date+make_interval(months=>v_value))::date; end if;
 update public.memberships set status='expired' where gym_id=v_gym and member_id=p_member_id and status='active';
 insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status,payment_status,amount_paid,amount_due,due_date)
 values(v_gym,p_member_id,p_plan_id,p_start_date,v_expiry,v_amount,'active',case when p_payment_status='paid' then 'paid' else 'pending' end,case when p_payment_status='paid' then v_amount else 0 end,case when p_payment_status='paid' then 0 else v_amount end,case when p_payment_status='pending' then p_due_date else null end) returning id into v_membership;
 if p_payment_status='paid' then v_receipt:='R'||right(extract(epoch from clock_timestamp())::bigint::text,9);insert into public.payments(gym_id,member_id,membership_id,receipt_no,amount,method) values(v_gym,p_member_id,v_membership,v_receipt,v_amount,p_method);end if;
 insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details) values(v_gym,v_uid,'renew_membership','membership',v_membership,jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount,'payment_status',p_payment_status));
 return v_membership;
end;$function$;

create or replace function public.renew_membership_v2(p_member_id uuid,p_plan_id uuid,p_start_date date,p_payment_status text default 'paid',p_due_date date default null,p_method text default null)
returns uuid language sql security invoker set search_path='' as $function$ select private.renew_membership_v2(p_member_id,p_plan_id,p_start_date,p_payment_status,p_due_date,p_method); $function$;

revoke all on function private.bootstrap_platform_admin() from public,anon,authenticated;
revoke all on function private.super_admin_update_gym_details(uuid,text,text) from public,anon,authenticated;
revoke all on function private.assign_membership_v2(uuid,uuid,date,text,date,text) from public,anon,authenticated;
revoke all on function private.renew_membership_v2(uuid,uuid,date,text,date,text) from public,anon,authenticated;

revoke execute on function public.bootstrap_platform_admin() from public,anon;
grant execute on function public.bootstrap_platform_admin() to authenticated;
revoke execute on function public.super_admin_update_gym_details(uuid,text,text) from public,anon;
grant execute on function public.super_admin_update_gym_details(uuid,text,text) to authenticated;
revoke execute on function public.assign_membership_v2(uuid,uuid,date,text,date,text) from public,anon;
grant execute on function public.assign_membership_v2(uuid,uuid,date,text,date,text) to authenticated;
revoke execute on function public.renew_membership_v2(uuid,uuid,date,text,date,text) from public,anon;
grant execute on function public.renew_membership_v2(uuid,uuid,date,text,date,text) to authenticated;

commit;