-- Minimize Data API table privileges for financial/audit domains.
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select on table public.memberships to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.audit_logs to authenticated;
