alter table public.memberships
  add column if not exists payment_status text not null default 'paid',
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists amount_due numeric(12,2) not null default 0,
  add column if not exists due_date date;

alter table public.memberships drop constraint if exists memberships_payment_status_check;
alter table public.memberships add constraint memberships_payment_status_check
  check (payment_status in ('paid','pending','partial'));

update public.memberships
set amount_paid = coalesce(amount_paid, amount),
    amount_due = greatest(coalesce(amount_due,0),0),
    payment_status = case when coalesce(amount_due,0) > 0 then 'pending' else 'paid' end
where amount_paid = 0 and amount_due = 0;

create index if not exists memberships_gym_payment_status_idx
  on public.memberships(gym_id,payment_status,due_date);