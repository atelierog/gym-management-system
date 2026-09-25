-- Gym Manager role-specific login URLs
-- Canonical pattern:
-- https://atelierog.co.in/gym-manager/<gym-slug>/owner
-- https://atelierog.co.in/gym-manager/<gym-slug>/trainer
-- https://atelierog.co.in/gym-manager/<gym-slug>/member

alter table public.gyms add column if not exists slug text;

-- Backfill existing gyms with stable, readable slugs. The short id suffix prevents collisions.
update public.gyms
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(id::text, '-', ''), 6)
where coalesce(trim(slug), '') = '';

create unique index if not exists gyms_slug_unique_idx on public.gyms(slug);
create index if not exists profiles_gym_role_idx on public.profiles(gym_id, role);
