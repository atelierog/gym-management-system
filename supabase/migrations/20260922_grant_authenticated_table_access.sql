-- The authenticated role needs table-level privileges before RLS policies can authorize operations.
grant select, insert, update, delete on public.gyms to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.membership_plans to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.platform_admins to authenticated;