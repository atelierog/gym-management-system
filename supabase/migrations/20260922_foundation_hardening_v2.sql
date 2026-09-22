-- Foundation hardening v2
-- Keeps Super Admin RPCs safely callable by authenticated users while retaining server-side authorization.
-- Prevents tenant admins from changing roles or moving accounts between gyms.
-- Enforces payment-state arithmetic at the database boundary.

create or replace function public.bootstrap_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if v_uid is null or v_email <> 'atelierog.co@gmail.com' then raise exception 'Super Admin access required'; end if;
  insert into public.platform_admins(id,email,full_name,status)
  values(v_uid,v_email,'Atelier OG Super Admin','active')
  on conflict (id) do update set email=excluded.email,status='active';
  return true;
end;
$$;

create or replace function public.super_admin_update_gym_details(p_gym_id uuid,p_phone text default null,p_platform_plan text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then raise exception 'Super Admin access required'; end if;
  update public.gyms set platform_plan=coalesce(nullif(trim(p_platform_plan),''),platform_plan) where id=p_gym_id;
  update public.profiles set phone=case when p_phone is null then phone else nullif(trim(p_phone),'') end where gym_id=p_gym_id and role='admin';
  return found;
end;
$$;

grant execute on function public.bootstrap_platform_admin() to authenticated;
grant execute on function public.super_admin_update_gym_details(uuid,text,text) to authenticated;

create or replace function private.prevent_tenant_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.current_role())='admin' and not (select private.is_super_admin())
     and (old.role is distinct from new.role or old.gym_id is distinct from new.gym_id) then
    raise exception 'Gym Admin cannot change account role or gym';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_tenant_role_escalation on public.profiles;
create trigger profiles_prevent_tenant_role_escalation
before update on public.profiles
for each row execute function private.prevent_tenant_role_escalation();

create or replace function private.normalize_membership_payment_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount_paid < 0 or new.amount_due < 0 then raise exception 'Payment amounts cannot be negative'; end if;
  if new.amount_paid + new.amount_due <> new.amount then raise exception 'Paid plus due must equal membership amount'; end if;
  new.payment_status := case when new.amount_due=0 then 'paid' when new.amount_paid>0 then 'partial' else 'pending' end;
  return new;
end;
$$;

drop trigger if exists memberships_payment_state_guard on public.memberships;
create trigger memberships_payment_state_guard
before insert or update of amount,amount_paid,amount_due,payment_status on public.memberships
for each row execute function private.normalize_membership_payment_state();
