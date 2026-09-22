-- Remove obsolete exposed SECURITY DEFINER RPCs and move profile security trigger to private schema.
begin;

create or replace function private.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path=''
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
for each row execute function private.protect_profile_security_fields();

revoke execute on function public.protect_profile_security_fields() from public,anon,authenticated;
drop function if exists public.protect_profile_security_fields();

revoke execute on function public.bootstrap_platform_admin() from public,anon,authenticated;
revoke execute on function public.super_admin_update_gym_details(uuid,text,text) from public,anon,authenticated;

commit;
