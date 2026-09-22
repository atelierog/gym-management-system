alter table public.profiles
  add column if not exists password_change_required boolean not null default false,
  add column if not exists password_reset_at timestamptz;

create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles
  set password_change_required=false,
      password_reset_at=coalesce(password_reset_at, now())
  where id=auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;