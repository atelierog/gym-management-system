-- Fix Gym Manager transactional email secret lookup.
-- The function is already restricted to service_role by EXECUTE privileges;
-- do not depend on request.jwt.claim.role being populated inside Edge Functions.
create or replace function public.get_gym_manager_resend_key()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return (select decrypted_secret from vault.decrypted_secrets where name = 'gymos_resend_api_key' limit 1);
end;
$$;

revoke all on function public.get_gym_manager_resend_key() from public, anon, authenticated;
grant execute on function public.get_gym_manager_resend_key() to service_role;
