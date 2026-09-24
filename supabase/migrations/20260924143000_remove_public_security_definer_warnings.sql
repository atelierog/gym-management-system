begin;

create or replace function private.get_admin_audit_logs(p_limit integer default 200)
returns setof public.audit_logs
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_gym_id uuid;
  v_role text;
begin
  select p.gym_id, p.role into v_gym_id, v_role
  from public.profiles p
  where p.id = (select auth.uid());

  if v_gym_id is null or v_role <> 'admin' then
    raise exception 'Not authorized';
  end if;

  return query
    select a.*
    from public.audit_logs a
    where a.gym_id = v_gym_id
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$function$;

create or replace function private.record_audit(
  p_action text,
  p_entity text default null,
  p_entity_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_gym uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  v_gym := (select private.current_gym_id());
  if v_gym is null then
    raise exception 'Gym profile not found';
  end if;

  insert into public.audit_logs(gym_id,actor_id,action,entity,entity_id,details)
  values(v_gym,(select auth.uid()),p_action,p_entity,p_entity_id,coalesce(p_details,'{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.assign_membership_v2(
  p_member_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_payment_status text default 'paid',
  p_due_date date default null,
  p_method text default null
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.assign_membership_v2(
    p_member_id,p_plan_id,p_start_date,p_payment_status,p_due_date,p_method
  );
$function$;

create or replace function public.get_admin_audit_logs(p_limit integer default 200)
returns setof public.audit_logs
language sql
stable
set search_path = ''
as $function$
  select * from private.get_admin_audit_logs(p_limit);
$function$;

create or replace function public.record_audit(
  p_action text,
  p_entity text default null,
  p_entity_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.record_audit(p_action,p_entity,p_entity_id,p_details);
$function$;

revoke all on function private.get_admin_audit_logs(integer) from public;
revoke all on function private.record_audit(text,text,uuid,jsonb) from public;
grant execute on function private.get_admin_audit_logs(integer) to authenticated;
grant execute on function private.record_audit(text,text,uuid,jsonb) to authenticated;

revoke all on function public.assign_membership_v2(uuid,uuid,date,text,date,text) from public;
revoke all on function public.get_admin_audit_logs(integer) from public;
revoke all on function public.record_audit(text,text,uuid,jsonb) from public;
grant execute on function public.assign_membership_v2(uuid,uuid,date,text,date,text) to authenticated;
grant execute on function public.get_admin_audit_logs(integer) to authenticated;
grant execute on function public.record_audit(text,text,uuid,jsonb) to authenticated;

commit;