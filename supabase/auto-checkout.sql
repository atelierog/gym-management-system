-- Execute periodically with a scheduler.
update public.attendance
set check_out=check_in + interval '3 hours',
    checkout_type='auto',
    status='closed'
where check_out is null
  and check_in <= now() - interval '3 hours';
