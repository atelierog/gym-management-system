-- Gym Manager V1 current database schema
-- Production hardening changes are recorded in:
-- supabase/migrations/20260922_gymos_hardening.sql
-- Keep this file aligned with production before provisioning a new tenant.

create extension if not exists pgcrypto;

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  latitude numeric(9,6),
  longitude numeric(9,6),
  allowed_radius_m integer not null default 100,
  created_at timestamptz not null default now(),
  auto_checkout_enabled boolean not null default true,
  auto_checkout_minutes integer not null default 180,
  timezone text not null default 'Asia/Kolkata'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  login_id text not null,
  full_name text not null,
  role text not null check (role in ('admin','trainer','member')),
  status text not null default 'active',
  phone text,
  email text,
  password_change_required boolean not null default false,
  password_reset_at timestamptz,
  created_at timestamptz not null default now(),
  unique(gym_id,login_id)
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  duration_months integer,
  duration_value integer not null check (duration_value > 0 and duration_value <= 3650),
  duration_unit text not null check (duration_unit in ('day','month')),
  price numeric(12,2) not null default 0,
  active boolean not null default true,
  unique(gym_id,duration_unit,duration_value)
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
  created_at timestamptz not null default now(),
  payment_status text not null default 'paid' check (payment_status in ('paid','pending','partial')),
  amount_paid numeric(12,2) not null default 0,
  amount_due numeric(12,2) not null default 0,
  due_date date,
  check (expiry_date >= start_date)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  check_in_lat numeric(9,6),
  check_in_lng numeric(9,6),
  checkout_type text,
  status text not null default 'present',
  check (check_out is null or check_out >= check_in)
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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  scheduled_for date not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,type,scheduled_for)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- The exact production RLS policies, helper functions, checkout function,
-- audit function, constraints, indexes and scheduled functions are maintained
-- in the hardening migration above. The platform super-admin layer is maintained
-- in supabase/migrations/20260922_platform_super_admin.sql. Do not recreate old
-- prototype tenant_* policies from earlier versions of this file.

-- Duration uniqueness is enforced by the table constraint above.
-- Production permissions, functions, RLS, triggers and platform administration are maintained by versioned migrations.
