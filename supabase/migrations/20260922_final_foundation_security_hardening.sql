-- Final foundation hardening for GymOS production
-- Apply after all prior production migrations.

grant execute on function public.bootstrap_platform_admin() to authenticated;
grant execute on function public.super_admin_update_gym_details(uuid,text,text) to authenticated;

create or replace function public.guard_admin_profile_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
begin
  if auth.uid() is null or auth.uid() = old.id then
    return new;
  end if;
  select private.current_role() into v_role;
  if v_role = 'admin' then
    if new.gym_id is distinct from old.gym_id
       or new.role is distinct from old.role
       or new.login_id is distinct from old.login_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.id is distinct from old.id then
      raise exception 'Gym Admin cannot change protected account fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_admin_profile_update on public.profiles;
create trigger guard_admin_profile_update
before update on public.profiles
for each row execute function public.guard_admin_profile_update();

revoke insert on public.attendance from authenticated;
revoke update on public.attendance from authenticated;

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update to authenticated
using (
  gym_id = (select private.current_gym_id())
  and (select private.current_role()) = 'admin'
  and id <> (select auth.uid())
)
with check (
  gym_id = (select private.current_gym_id())
  and (select private.current_role()) = 'admin'
);