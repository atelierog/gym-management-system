-- Finalize SECURITY DEFINER boundaries.
-- Keep only thin public invoker wrappers exposed to PostgREST.
-- Privileged implementations live in the private schema.

revoke execute on function public.bootstrap_platform_admin() from authenticated,anon,public;
revoke execute on function public.guard_admin_profile_update() from authenticated,anon,public;
drop trigger if exists guard_admin_profile_update on public.profiles;

create or replace function private.guard_admin_profile_update()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_role text;
begin
  if auth.uid() is null or auth.uid() = old.id then return new; end if;
  select private.current_role() into v_role;
  if v_role='admin' and (
    new.gym_id is distinct from old.gym_id or
    new.role is distinct from old.role or
    new.login_id is distinct from old.login_id or
    new.auth_user_id is distinct from old.auth_user_id or
    new.id is distinct from old.id
  ) then raise exception 'Gym Admin cannot change protected account fields'; end if;
  return new;
end;
$$;
create trigger guard_admin_profile_update before update on public.profiles
for each row execute function private.guard_admin_profile_update();

revoke execute on function public.check_in_attendance(numeric,numeric) from authenticated,anon,public;
create or replace function private.check_in_attendance(p_lat numeric,p_lng numeric)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_gym_id uuid; v_role text; v_lat numeric; v_lng numeric; v_radius integer; v_timezone text; v_today date; v_distance numeric; v_id uuid;
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
 if v_role='member' and not exists(select 1 from public.memberships m where m.member_id=v_uid and m.gym_id=v_gym_id and m.status='active' and m.start_date<=v_today and m.expiry_date>=v_today) then raise exception 'Active membership required'; end if;
 if exists(select 1 from public.attendance a where a.user_id=v_uid and a.gym_id=v_gym_id and (a.check_in at time zone coalesce(v_timezone,'Asia/Kolkata'))::date=v_today and a.check_out is null) then raise exception 'Already checked in'; end if;
 v_distance := 6371000*2*asin(sqrt(power(sin(radians(p_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-v_lng)/2),2)));
 if v_distance>v_radius then raise exception 'You are outside the gym check-in area'; end if;
 insert into public.attendance(gym_id,user_id,check_in,check_in_lat,check_in_lng,status) values(v_gym_id,v_uid,now(),p_lat,p_lng,'present') returning id into v_id;
 return v_id;
end;
$$;
grant execute on function private.check_in_attendance(numeric,numeric) to authenticated;
create or replace function public.check_in_attendance(p_lat numeric,p_lng numeric)
returns uuid language sql security invoker set search_path='' as $$ select private.check_in_attendance(p_lat,p_lng); $$;
grant execute on function public.check_in_attendance(numeric,numeric) to authenticated;

revoke execute on function public.super_admin_update_gym_details(uuid,text,text) from authenticated,anon,public;
create or replace function private.super_admin_update_gym_details(p_gym_id uuid,p_phone text default null,p_platform_plan text default null)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.platform_admins where id=auth.uid() and status='active') then raise exception 'Super Admin access required'; end if;
 if p_phone is not null then update public.profiles set phone=nullif(trim(p_phone),'') where gym_id=p_gym_id and role='admin'; end if;
 if p_platform_plan is not null then update public.gyms set platform_plan=left(trim(p_platform_plan),80) where id=p_gym_id; end if;
 return true;
end;
$$;
grant execute on function private.super_admin_update_gym_details(uuid,text,text) to authenticated;
create or replace function public.super_admin_update_gym_details(p_gym_id uuid,p_phone text default null,p_platform_plan text default null)
returns boolean language sql security invoker set search_path='' as $$ select private.super_admin_update_gym_details(p_gym_id,p_phone,p_platform_plan); $$;
grant execute on function public.super_admin_update_gym_details(uuid,text,text) to authenticated;