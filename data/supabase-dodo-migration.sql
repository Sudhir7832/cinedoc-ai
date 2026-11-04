-- Run once in Supabase SQL Editor for existing CineDoc databases.
alter table public.saas_settings add column if not exists enable_dodo boolean not null default false;
alter table public.saas_settings add column if not exists dodo_api_key text default '';
alter table public.saas_settings add column if not exists dodo_webhook_key text default '';
alter table public.saas_settings add column if not exists dodo_mode text not null default 'test';

alter table public.payment_transactions drop constraint if exists payment_transactions_gateway_check;
alter table public.payment_transactions
  add constraint payment_transactions_gateway_check
  check (gateway in ('stripe', 'razorpay', 'dodo', 'test'));
