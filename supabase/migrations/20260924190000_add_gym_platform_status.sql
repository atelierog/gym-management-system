alter table public.gyms add column if not exists platform_status text not null default 'active';

alter table public.gyms drop constraint if exists gyms_platform_status_check;
alter table public.gyms add constraint gyms_platform_status_check check (platform_status in ('active','suspended'));

create index if not exists gyms_platform_status_idx on public.gyms(platform_status);
