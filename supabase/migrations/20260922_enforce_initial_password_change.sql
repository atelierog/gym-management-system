create or replace function public.set_initial_password_change_required()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.role in ('member','trainer') and new.password_change_required = false then
    new.password_change_required := true;
    new.password_reset_at := coalesce(new.password_reset_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_initial_password_change on public.profiles;
create trigger profiles_initial_password_change
before insert on public.profiles
for each row execute function public.set_initial_password_change_required();

revoke execute on function public.set_initial_password_change_required() from public, anon, authenticated;