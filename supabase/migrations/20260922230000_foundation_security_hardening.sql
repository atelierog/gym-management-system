-- Foundation hardening: prevent admin role/gym escalation and restrict payment reads.
create or replace function public.prevent_admin_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is not null
     and auth.uid() <> old.id
     and (select private.current_role()) = 'admin'
  then
    if new.role is distinct from old.role then
      raise exception 'Gym admins cannot change user roles';
    end if;
    if new.gym_id is distinct from old.gym_id then
      raise exception 'Gym admins cannot move users between gyms';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_escalation on public.profiles;
create trigger profiles_prevent_admin_escalation
before update on public.profiles
for each row execute function public.prevent_admin_profile_escalation();

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (
  gym_id = (select private.current_gym_id())
  and (
    member_id = (select auth.uid())
    or (select private.current_role()) = 'admin'
  )
);

revoke all on function public.prevent_admin_profile_escalation() from public;
