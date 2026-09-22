-- Fix Super Admin bootstrap to perform the protected platform-admin insert server-side.
-- The function remains restricted to the authenticated Atelier OG Super Admin email.
create or replace function public.bootstrap_platform_admin()
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_email := lower(coalesce((select auth.jwt()->>'email'),''));
  if v_email <> 'atelierog.co@gmail.com' then
    raise exception 'Super Admin bootstrap is restricted';
  end if;

  insert into public.platform_admins(id,email,full_name,status)
  values(auth.uid(),v_email,'Atelier OG Super Admin','active')
  on conflict(id) do update
    set email=excluded.email,
        status='active';

  return true;
end
$$;

revoke all on function public.bootstrap_platform_admin() from public;
grant execute on function public.bootstrap_platform_admin() to authenticated;
