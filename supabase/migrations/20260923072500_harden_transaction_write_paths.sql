-- Harden financial and membership write paths so the browser cannot bypass
-- transactional server-side operations.
--
-- The public RPC wrappers call SECURITY DEFINER implementations. They validate
-- the authenticated gym admin, tenant, membership/payment relationship and
-- keep payment + membership balance + audit changes atomic.

create or replace function private.collect_payment_v2(
  p_membership_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid := (select private.current_gym_id());
  v_member uuid;
  v_amount numeric;
  v_paid numeric;
  v_due numeric;
  v_new_due numeric;
  v_payment uuid;
  v_receipt text;
begin
  if v_uid is null or (select private.current_role()) <> 'admin' then
    raise exception 'Only gym admins can collect payments';
  end if;

  if p_method not in ('cash','upi','card','bank_transfer') then
    raise exception 'Valid payment method is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select member_id, amount, amount_paid, amount_due
    into v_member, v_amount, v_paid, v_due
  from public.memberships
  where id = p_membership_id
    and gym_id = v_gym
    and status = 'active'
  for update;

  if v_member is null then
    raise exception 'Active membership not found';
  end if;

  if p_amount > v_due then
    raise exception 'Payment cannot exceed the outstanding due';
  end if;

  v_new_due := greatest(0, v_due - p_amount);

  v_receipt := 'R' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9));

  insert into public.payments(
    gym_id, member_id, membership_id, receipt_no, amount, method
  )
  values(
    v_gym, v_member, p_membership_id, v_receipt, p_amount, p_method
  )
  returning id into v_payment;

  update public.memberships
  set amount_paid = coalesce(v_paid, 0) + p_amount,
      amount_due = v_new_due,
      payment_status = case
        when v_new_due = 0 then 'paid'
        else 'partial'
      end
  where id = p_membership_id
    and gym_id = v_gym;

  insert into public.audit_logs(
    gym_id, actor_id, action, entity, entity_id, details
  )
  values(
    v_gym,
    v_uid,
    'record_payment',
    'payment',
    v_payment,
    jsonb_build_object(
      'receipt_no', v_receipt,
      'amount', p_amount,
      'method', p_method,
      'membership_id', p_membership_id,
      'remaining_due', v_new_due
    )
  );

  return v_payment;
end;
$function$;

create or replace function public.collect_payment_v2(
  p_membership_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.collect_payment_v2(p_membership_id, p_amount, p_method);
$function$;

revoke execute on function public.collect_payment_v2(uuid,numeric,text) from public, anon;
grant execute on function public.collect_payment_v2(uuid,numeric,text) to authenticated;


create or replace function private.correct_payment_v2(
  p_payment_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid := (select private.current_gym_id());
  v_old_amount numeric;
  v_membership uuid;
  v_member uuid;
  v_membership_amount numeric;
  v_total numeric;
  v_due numeric;
  v_status text;
begin
  if v_uid is null or (select private.current_role()) <> 'admin' then
    raise exception 'Only gym admins can correct payments';
  end if;

  if p_method not in ('cash','upi','card','bank_transfer') then
    raise exception 'Valid payment method is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select amount, membership_id, member_id
    into v_old_amount, v_membership, v_member
  from public.payments
  where id = p_payment_id
    and gym_id = v_gym
  for update;

  if v_old_amount is null then
    raise exception 'Payment not found';
  end if;

  if v_membership is not null then
    select amount
      into v_membership_amount
    from public.memberships
    where id = v_membership
      and gym_id = v_gym
      and member_id = v_member
    for update;

    if v_membership_amount is null then
      raise exception 'Payment membership not found';
    end if;

    select coalesce(sum(case when id = p_payment_id then p_amount else amount end), 0)
      into v_total
    from public.payments
    where membership_id = v_membership
      and gym_id = v_gym;

    if v_total > v_membership_amount then
      raise exception 'Corrected payments cannot exceed membership amount';
    end if;
  end if;

  update public.payments
  set amount = p_amount,
      method = p_method
  where id = p_payment_id
    and gym_id = v_gym;

  if v_membership is not null then
    v_due := greatest(0, v_membership_amount - v_total);
    v_status := case
      when v_due = 0 then 'paid'
      when v_total > 0 then 'partial'
      else 'pending'
    end;

    update public.memberships
    set amount_paid = v_total,
        amount_due = v_due,
        payment_status = v_status
    where id = v_membership
      and gym_id = v_gym;
  end if;

  insert into public.audit_logs(
    gym_id, actor_id, action, entity, entity_id, details
  )
  values(
    v_gym,
    v_uid,
    'update_payment',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'old_amount', v_old_amount,
      'amount', p_amount,
      'method', p_method,
      'membership_id', v_membership
    )
  );

  return p_payment_id;
end;
$function$;

create or replace function public.correct_payment_v2(
  p_payment_id uuid,
  p_amount numeric,
  p_method text
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.correct_payment_v2(p_payment_id, p_amount, p_method);
$function$;

revoke execute on function public.correct_payment_v2(uuid,numeric,text) from public, anon;
grant execute on function public.correct_payment_v2(uuid,numeric,text) to authenticated;


-- Remove direct browser write paths for memberships, payments and audit logs.
drop policy if exists memberships_admin_insert on public.memberships;
drop policy if exists memberships_admin_update on public.memberships;
drop policy if exists memberships_admin_delete on public.memberships;

drop policy if exists payments_admin_insert on public.payments;
drop policy if exists payments_admin_update on public.payments;
drop policy if exists payments_admin_delete on public.payments;

drop policy if exists audit_insert_self on public.audit_logs;

revoke insert, update, delete on table public.memberships from authenticated;
revoke insert, update, delete on table public.payments from authenticated;
revoke insert, update, delete on table public.audit_logs from authenticated;
