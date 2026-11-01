-- CineDoc AI Supabase schema
-- Run in the Supabase SQL editor before starting the application.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  credits integer not null default 10 check (credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  total_documentaries_created integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documentary_jobs (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_user on public.documentary_jobs(user_id);
create index if not exists idx_jobs_status on public.documentary_jobs(status);
create index if not exists idx_jobs_created on public.documentary_jobs(created_at desc);

create table if not exists public.payment_transactions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  pack_id text not null,
  pack_name text not null,
  amount numeric(10,2) not null,
  currency text not null check (currency in ('USD', 'INR')),
  credits_added integer not null default 0,
  gateway text not null check (gateway in ('stripe', 'razorpay', 'test')),
  status text not null default 'pending' check (status in ('completed', 'pending', 'failed')),
  payment_id text,
  provider_payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_user on public.payment_transactions(user_id);
create index if not exists idx_transactions_payment on public.payment_transactions(payment_id);

create table if not exists public.credit_ledger (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  balance_after integer,
  type text not null check (type in ('purchase', 'generation', 'admin_adjustment', 'welcome')),
  description text not null,
  reference_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_ledger_user on public.credit_ledger(user_id, created_at desc);

create table if not exists public.saas_settings (
  id text primary key default 'global_config',
  welcome_credits integer not null default 10,
  credits_per_scene integer not null default 1,
  enable_test_mode boolean not null default false,
  enable_stripe boolean not null default true,
  enable_razorpay boolean not null default true,
  stripe_publishable_key text default '',
  stripe_secret_key text default '',
  razorpay_key_id text default '',
  razorpay_key_secret text default '',
  pricing_packs jsonb not null default '[]'::jsonb,
  runtime_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id text primary key,
  title text not null,
  description text not null default '',
  video_url text not null,
  poster_url text,
  format text not null check (format in ('landscape', 'reels', 'tiktok')),
  quote text,
  attribution text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = check_user and role = 'admin') $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare welcome integer;
begin
  select coalesce(welcome_credits, 10) into welcome from public.saas_settings where id = 'global_config';
  welcome := coalesce(welcome, 10);
  insert into public.profiles (id, email, name, role, credits)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'user', welcome)
  on conflict (id) do nothing;
  insert into public.credit_ledger (id, user_id, amount, balance_after, type, description)
  values ('credit_welcome_' || new.id::text, new.id, welcome, welcome, 'welcome', 'Welcome credits')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.reserve_job_credits(p_user_id uuid, p_cost integer)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare profile public.profiles;
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_user_id and not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into profile from public.profiles where id = p_user_id for update;
  if profile.id is null then raise exception 'User not found'; end if;
  if profile.role <> 'admin' and profile.credits - profile.reserved_credits < p_cost then
    raise exception 'Insufficient credits. You need % available credits, but you currently have %.', p_cost, profile.credits - profile.reserved_credits;
  end if;
  if profile.role <> 'admin' then update public.profiles set reserved_credits = reserved_credits + p_cost, updated_at = now() where id = p_user_id returning * into profile; end if;
  return profile;
end;
$$;

create or replace function public.release_job_credits(p_user_id uuid, p_cost integer)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare profile public.profiles;
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_user_id and not public.is_admin() then raise exception 'Forbidden'; end if;
  update public.profiles set reserved_credits = greatest(0, reserved_credits - p_cost), updated_at = now()
  where id = p_user_id returning * into profile;
  return profile;
end;
$$;

create or replace function public.charge_job_credits(p_user_id uuid, p_cost integer, p_job_id text, p_topic text)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare profile public.profiles;
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_user_id and not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into profile from public.profiles where id = p_user_id for update;
  if profile.id is null then raise exception 'User not found'; end if;
  if profile.role <> 'admin' then
    if profile.credits < p_cost then raise exception 'Reserved credit charge failed'; end if;
    update public.profiles set credits = credits - p_cost, reserved_credits = greatest(0, reserved_credits - p_cost), total_documentaries_created = total_documentaries_created + 1, updated_at = now()
    where id = p_user_id returning * into profile;
    insert into public.credit_ledger (id, user_id, amount, balance_after, type, description, reference_id)
    values ('credit_generation_' || p_job_id, p_user_id, -p_cost, profile.credits, 'generation', 'Video generated: ' || p_topic, p_job_id)
    on conflict (id) do nothing;
  else
    update public.profiles set total_documentaries_created = total_documentaries_created + 1, updated_at = now() where id = p_user_id returning * into profile;
  end if;
  return profile;
end;
$$;

alter table public.profiles enable row level security;
alter table public.documentary_jobs enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.saas_settings enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists jobs_owner on public.documentary_jobs;
create policy jobs_owner on public.documentary_jobs for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists transactions_owner on public.payment_transactions;
create policy transactions_owner on public.payment_transactions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists ledger_owner on public.credit_ledger;
create policy ledger_owner on public.credit_ledger for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists testimonials_public on public.testimonials;
create policy testimonials_public on public.testimonials for select using (published or public.is_admin());

insert into public.saas_settings (id, pricing_packs)
values ('global_config', '[{"id":"pack_creator","name":"Creator","credits":150,"priceUsd":11,"priceInr":999,"videoMinutes":15,"description":"For creators producing polished shorts and regular documentary episodes.","popular":false},{"id":"pack_pro","name":"Creator Pro","credits":400,"priceUsd":24,"priceInr":2199,"videoMinutes":40,"description":"For growing channels, campaigns, and client work.","popular":true},{"id":"pack_studio","name":"Studio","credits":1000,"priceUsd":49,"priceInr":4499,"videoMinutes":100,"description":"High-volume capacity for production teams.","popular":false}]'::jsonb)
on conflict (id) do nothing;
