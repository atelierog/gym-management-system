# Supabase database schema

This file defines the V1 multi-tenant database.

```sql
create extension if not exists pgcrypto;

create table if not exists public.gyms (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 latitude numeric(9,6),
 longitude numeric(9,6),
 allowed_radius_m integer not null default 100,
 created_at timestamptz not null default now()
);

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 gym_id uuid not null references public.gyms(id) on delete cascade,
 login_id text not null,
 full_name text not null,
 role text not null check (role in ('admin','trainer','member')),
 status text not null default 'active',
 created_at timestamptz not null default now(),
 unique(gym_id,login_id)
);

create table if not exists public.membership_plans (
 id uuid primary key default gen_random_uuid(),
 gym_id uuid not null references public.gyms(id) on delete cascade,
 name text not null,
 duration_months integer not null,
 price numeric(12,2) not null default 0
);

create table if not exists public.memberships (
 id uuid primary key default gen_random_uuid(),
 gym_id uuid not null references public.gyms(id) on delete cascade,
 member_id uuid not null references public.profiles(id) on delete cascade,
 plan_id uuid references public.membership_plans(id),
 start_date date not null,
 expiry_date date not null,
 amount numeric(12,2) not null default 0,
 status text not null default 'active',
 created_at timestamptz not null default now()
);

create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(),
 gym_id uuid not null references public.gyms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 check_in timestamptz not null default now(),
 check_out timestamptz,
 check_in_lat numeric(9,6),
 check_in_lng numeric(9,6),
 checkout_type text check (checkout_type in ('manual','auto')),
 status text not null default 'present'
);

create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 gym_id uuid not null references public.gyms(id) on delete cascade,
 member_id uuid not null references public.profiles(id) on delete cascade,
 membership_id uuid references public.memberships(id),
 receipt_no text not null,
 amount numeric(12,2) not null check (amount >= 0),
 method text not null check (method in ('cash','upi','card','bank_transfer')),
 paid_at timestamptz not null default now(),
 unique(gym_id,receipt_no)
);

create or replace function public.current_gym_id()
returns uuid language sql stable security definer set search_path=public
as $$ select gym_id from public.profiles where id=auth.uid() $$;

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;

create policy tenant_gyms on public.gyms for select using (id=public.current_gym_id());
create policy tenant_profiles on public.profiles for select using (gym_id=public.current_gym_id());
create policy tenant_plans on public.membership_plans for all using (gym_id=public.current_gym_id()) with check (gym_id=public.current_gym_id());
create policy tenant_memberships on public.memberships for all using (gym_id=public.current_gym_id()) with check (gym_id=public.current_gym_id());
create policy tenant_attendance on public.attendance for all using (gym_id=public.current_gym_id()) with check (gym_id=public.current_gym_id());
create policy tenant_payments on public.payments for all using (gym_id=public.current_gym_id()) with check (gym_id=public.current_gym_id());
```
