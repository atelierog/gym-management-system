-- Optimize the platform admin self-insert RLS policy without changing its authorization semantics.
drop policy if exists platform_admin_self_insert on public.platform_admins;

create policy platform_admin_self_insert
on public.platform_admins
as permissive
for insert
to authenticated
with check (
  id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and lower(email) = 'atelierog.co@gmail.com'
  and status = 'active'
);
