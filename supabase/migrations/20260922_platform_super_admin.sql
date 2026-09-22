-- GymOS platform super-admin / SaaS tenant layer
create table if not exists public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default 'Atelier OG Super Admin',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon;
grant select on public.platform_admins to authenticated;
drop policy if exists platform_admin_self_select on public.platform_admins;
create policy platform_admin_self_select on public.platform_admins for select to authenticated using (id=(select auth.uid()));
create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.platform_admins pa where pa.id=(select auth.uid()) and pa.status='active') $$;
revoke all on function private.is_super_admin() from public;
grant execute on function private.is_super_admin() to authenticated;
create or replace function public.bootstrap_platform_admin()
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_email text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_email:=lower(coalesce((select auth.jwt()->>'email'),''));
 if v_email <> 'atelierog.co@gmail.com' then raise exception 'Super Admin bootstrap is restricted'; end if;
 insert into public.platform_admins(id,email,full_name,status) values(auth.uid(),v_email,'Atelier OG Super Admin','active')
 on conflict(id) do update set email=excluded.email,status='active';
 return true;
end $$;
revoke all on function public.bootstrap_platform_admin() from public;
grant execute on function public.bootstrap_platform_admin() to authenticated;
drop policy if exists gyms_super_admin_select on public.gyms;
create policy gyms_super_admin_select on public.gyms for select to authenticated using ((select private.is_super_admin()) or id=(select private.current_gym_id()));
drop policy if exists profiles_super_admin_select on public.profiles;
create policy profiles_super_admin_select on public.profiles for select to authenticated using ((select private.is_super_admin()) or gym_id=(select private.current_gym_id()));
create index if not exists platform_admins_status_idx on public.platform_admins(status);
