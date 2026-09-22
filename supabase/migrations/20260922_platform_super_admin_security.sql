-- Tighten platform bootstrap authorization: keep the bootstrap function SECURITY INVOKER.
drop policy if exists platform_admin_self_insert on public.platform_admins;
create policy platform_admin_self_insert on public.platform_admins
for insert to authenticated
with check (
  id=(select auth.uid())
  and lower(email)=lower(coalesce((select auth.jwt()->>'email'),''))
  and lower(email)='atelierog.co@gmail.com'
  and status='active'
);
create or replace function public.bootstrap_platform_admin()
returns boolean language plpgsql security invoker set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.platform_admins(id,email,full_name,status)
  values(auth.uid(),'atelierog.co@gmail.com','Atelier OG Super Admin','active')
  on conflict(id) do update set email=excluded.email,status='active';
  return true;
end
$$;
revoke all on function public.bootstrap_platform_admin() from public;
grant execute on function public.bootstrap_platform_admin() to authenticated;
