alter table public.membership_plans
  add column if not exists duration_value integer,
  add column if not exists duration_unit text;

update public.membership_plans
set duration_value = coalesce(duration_value, duration_months),
    duration_unit = coalesce(duration_unit, 'month');

alter table public.membership_plans
  drop constraint if exists membership_plans_duration_chk,
  drop constraint if exists membership_plans_duration_months_check,
  alter column duration_months drop not null,
  alter column duration_value set not null,
  alter column duration_unit set not null;

drop index if exists public.membership_plans_gym_duration_uidx;

alter table public.membership_plans
  add constraint membership_plans_duration_value_chk check (duration_value > 0 and duration_value <= 3650),
  add constraint membership_plans_duration_unit_chk check (duration_unit in ('day','month'));

create index if not exists membership_plans_gym_duration_idx
  on public.membership_plans(gym_id, duration_unit, duration_value);

create or replace function public.renew_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_amount numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_gym_id uuid;
  v_duration_value integer;
  v_duration_unit text;
  v_amount numeric;
  v_id uuid;
  v_expiry date;
begin
  if auth.uid() is null or (select private.current_role()) <> 'admin' then
    raise exception 'Only gym admins can renew memberships';
  end if;
  select p.gym_id into v_gym_id
  from public.profiles p
  where p.id=p_member_id and p.role='member' and p.gym_id=(select private.current_gym_id());
  if v_gym_id is null then raise exception 'Member not found in this gym'; end if;
  select mp.duration_value, mp.duration_unit, mp.price
    into v_duration_value, v_duration_unit, v_amount
  from public.membership_plans mp
  where mp.id=p_plan_id and mp.gym_id=v_gym_id and mp.active=true;
  if v_duration_value is null then raise exception 'Membership plan not found'; end if;
  v_amount := coalesce(p_amount,v_amount);
  if v_duration_unit='day' then
    v_expiry := p_start_date + v_duration_value;
  else
    v_expiry := (p_start_date + make_interval(months=>v_duration_value))::date;
  end if;
  update public.memberships m set status='expired'
  where m.gym_id=v_gym_id and m.member_id=p_member_id and m.status='active';
  insert into public.memberships(gym_id,member_id,plan_id,start_date,expiry_date,amount,status)
  values(v_gym_id,p_member_id,p_plan_id,p_start_date,v_expiry,v_amount,'active')
  returning id into v_id;
  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym_id,auth.uid(),'renew_membership','membership',v_id,
         jsonb_build_object('member_id',p_member_id,'plan_id',p_plan_id,'amount',v_amount));
  return v_id;
end $function$;