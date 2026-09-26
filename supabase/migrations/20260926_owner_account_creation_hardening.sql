-- Gym Manager Owner Portal account-creation hardening.
-- Allocates Member/Trainer login IDs transactionally so two registrations cannot
-- receive the same next ID.

create table if not exists public.login_id_sequences (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role text not null check (role in ('member','trainer')),
  year_code text not null check (year_code ~ '^[0-9]{2}$'),
  next_number integer not null default 1 check (next_number > 0),
  updated_at timestamptz not null default now(),
  primary key (gym_id, role, year_code)
);

alter table public.login_id_sequences enable row level security;

revoke all on public.login_id_sequences from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'allocate_login_id'
  ) then
    execute $fn$
      create function public.allocate_login_id(p_role text, p_gym_id uuid default null)
      returns text
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $body$
      declare
        v_role text := lower(trim(coalesce(p_role,'')));
        v_gym_id uuid := p_gym_id;
        v_year text := to_char(current_date,'YY');
        v_number integer;
        v_prefix text;
        v_is_service boolean := coalesce((auth.jwt()->>'role'),'') = 'service_role';
      begin
        if v_role not in ('member','trainer') then
          raise exception 'Invalid account role';
        end if;

        if not v_is_service then
          if auth.uid() is null then
            raise exception 'Authentication required';
          end if;
          select gym_id into v_gym_id
          from public.profiles
          where id = auth.uid() and role = 'admin';
          if v_gym_id is null then
            raise exception 'Admin access required';
          end if;
        elsif v_gym_id is null then
          raise exception 'Gym ID required';
        end if;

        v_prefix := case when v_role = 'trainer' then 'TRN' else 'MEM' end;

        insert into public.login_id_sequences(gym_id, role, year_code, next_number)
        values (v_gym_id, v_role, v_year, 2)
        on conflict (gym_id, role, year_code)
        do update set next_number = public.login_id_sequences.next_number + 1,
                      updated_at = now()
        returning next_number - 1 into v_number;

        return v_prefix || '-' || v_year || '-' || lpad(v_number::text,3,'0');
      end;
      $body$;
    $fn$;
  end if;
end $$;

revoke all on function public.allocate_login_id(text,uuid) from public;
grant execute on function public.allocate_login_id(text,uuid) to authenticated, service_role;

-- Enforce the Owner Portal contract at the API boundary too.
-- Email and phone are required for Member/Trainer creation even if an older
-- client attempts to omit them.
