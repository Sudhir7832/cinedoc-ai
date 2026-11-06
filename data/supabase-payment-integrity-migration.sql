-- Atomic payment completion and webhook replay protection.
begin;

create unique index if not exists idx_payment_gateway_reference_unique
  on public.payment_transactions(gateway, payment_id)
  where payment_id is not null;
create unique index if not exists idx_payment_gateway_provider_unique
  on public.payment_transactions(gateway, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.payment_webhook_events (
  gateway text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (gateway, event_id),
  check (length(event_id) between 1 and 200)
);
alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from public, anon, authenticated;

create or replace function public.claim_payment_webhook_v1(p_gateway text, p_event_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_gateway not in ('dodo', 'stripe', 'razorpay') or length(coalesce(p_event_id, '')) not between 1 and 200 then
    raise exception 'Invalid webhook event';
  end if;
  insert into public.payment_webhook_events(gateway, event_id)
  values (p_gateway, p_event_id)
  on conflict do nothing;
  return found;
end;
$$;

create or replace function public.complete_payment_transaction_v1(
  p_transaction_id text,
  p_provider_payment_id text default null
)
returns public.payment_transactions
language plpgsql security definer set search_path = public
as $$
declare
  v_transaction public.payment_transactions;
  v_profile public.profiles;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_transaction from public.payment_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_transaction.status = 'completed' then return v_transaction; end if;
  if v_transaction.status <> 'pending' or v_transaction.credits_added <= 0 then
    raise exception 'Transaction cannot be completed';
  end if;

  select * into v_profile from public.profiles where id = v_transaction.user_id for update;
  if not found then raise exception 'User not found'; end if;
  update public.profiles
    set credits = credits + v_transaction.credits_added, updated_at = now()
    where id = v_profile.id returning * into v_profile;

  update public.payment_transactions
    set status = 'completed', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
    where id = v_transaction.id returning * into v_transaction;

  insert into public.credit_ledger(id, user_id, amount, balance_after, type, description, reference_id)
  values (
    'credit_purchase_' || md5(v_transaction.id), v_transaction.user_id,
    v_transaction.credits_added, v_profile.credits, 'purchase',
    v_transaction.pack_name || ' credit purchase', v_transaction.id
  );
  return v_transaction;
end;
$$;

create or replace function public.adjust_user_credits_v1(p_user_id uuid, p_amount integer)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles; v_next integer; v_actual integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'Invalid credit adjustment'; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  v_next := greatest(case when v_profile.role = 'admin' then 0 else v_profile.reserved_credits end, v_profile.credits + p_amount);
  v_actual := v_next - v_profile.credits;
  update public.profiles set credits = v_next, updated_at = now() where id = p_user_id returning * into v_profile;
  if v_actual <> 0 then
    insert into public.credit_ledger(id, user_id, amount, balance_after, type, description)
    values ('credit_admin_' || gen_random_uuid()::text, p_user_id, v_actual, v_next, 'admin_adjustment',
      case when v_actual > 0 then 'Credits added by administrator' else 'Credits deducted by administrator' end);
  end if;
  return v_profile;
end;
$$;

revoke all on function public.claim_payment_webhook_v1(text, text) from public, anon, authenticated;
revoke all on function public.complete_payment_transaction_v1(text, text) from public, anon, authenticated;
revoke all on function public.adjust_user_credits_v1(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_payment_webhook_v1(text, text) to service_role;
grant execute on function public.complete_payment_transaction_v1(text, text) to service_role;
grant execute on function public.adjust_user_credits_v1(uuid, integer) to service_role;

commit;
