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
  billing_enabled boolean not null default false,
  cancellation_requested_at timestamptz,
  worker_lease_id text,
  worker_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_user on public.documentary_jobs(user_id);
create index if not exists idx_jobs_status on public.documentary_jobs(status);
create index if not exists idx_jobs_created on public.documentary_jobs(created_at desc);

create table if not exists public.job_credit_reservations (
  job_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version integer not null default 1 check (policy_version = 1),
  status text not null default 'active' check (status in ('active', 'settled', 'released')),
  total_credits integer not null check (total_credits >= 0),
  consumed_credits integer not null default 0 check (consumed_credits >= 0),
  reserved_credits integer not null check (reserved_credits >= 0),
  script_credits integer not null check (script_credits >= 0),
  image_credits integer not null check (image_credits >= 0),
  narration_credits integer not null check (narration_credits >= 0),
  video_credits integer not null check (video_credits >= 0),
  scene_count integer not null check (scene_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz,
  constraint job_credit_allocations_total check (script_credits + image_credits + narration_credits + video_credits = total_credits),
  constraint job_credit_accounted_total check (consumed_credits + reserved_credits <= total_credits)
);
create index if not exists idx_job_credit_reservations_user on public.job_credit_reservations(user_id, created_at desc);

create table if not exists public.job_credit_consumptions (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.job_credit_reservations(job_id) on delete cascade,
  consumption_key text not null,
  stage text not null check (stage in ('script', 'images', 'narration', 'video')),
  scene_number integer,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (job_id, consumption_key),
  check ((stage = 'script' and scene_number is null) or (stage <> 'script' and scene_number is not null) or (stage = 'video' and consumption_key = 'video:final-render' and scene_number is null))
);
create index if not exists idx_job_credit_consumptions_job on public.job_credit_consumptions(job_id, stage);

create table if not exists public.payment_transactions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  pack_id text not null,
  pack_name text not null,
  amount numeric(10,2) not null,
  currency text not null check (currency in ('USD', 'INR')),
  credits_added integer not null default 0,
  gateway text not null check (gateway in ('stripe', 'razorpay', 'dodo', 'test')),
  status text not null default 'pending' check (status in ('completed', 'pending', 'failed')),
  payment_id text,
  provider_payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_user on public.payment_transactions(user_id);
create index if not exists idx_transactions_payment on public.payment_transactions(payment_id);
alter table public.payment_transactions drop constraint if exists payment_transactions_gateway_check;
alter table public.payment_transactions add constraint payment_transactions_gateway_check check (gateway in ('stripe', 'razorpay', 'dodo', 'test'));

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
  enable_dodo boolean not null default false,
  stripe_publishable_key text default '',
  stripe_secret_key text default '',
  razorpay_key_id text default '',
  razorpay_key_secret text default '',
  dodo_api_key text default '',
  dodo_webhook_key text default '',
  dodo_mode text not null default 'test' check (dodo_mode in ('test', 'live')),
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
  category text not null default 'documentary' check (category in ('documentary', 'kids')),
  quote text,
  attribution text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.saas_settings add column if not exists enable_dodo boolean not null default false;
alter table public.saas_settings add column if not exists dodo_api_key text default '';
alter table public.saas_settings add column if not exists dodo_webhook_key text default '';
alter table public.saas_settings add column if not exists dodo_mode text not null default 'test';
alter table public.documentary_jobs add column if not exists billing_enabled boolean not null default false;
alter table public.documentary_jobs add column if not exists cancellation_requested_at timestamptz;
alter table public.documentary_jobs add column if not exists worker_lease_id text;
alter table public.documentary_jobs add column if not exists worker_lease_expires_at timestamptz;
alter table public.testimonials add column if not exists category text not null default 'documentary';
alter table public.testimonials drop constraint if exists testimonials_category_check;
alter table public.testimonials add constraint testimonials_category_check check (category in ('documentary', 'kids'));

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

create or replace function public.save_documentary_job_v1(
  p_job_id text, p_user_id uuid, p_status text, p_data jsonb, p_created_at timestamptz, p_billing_enabled boolean
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_job public.documentary_jobs; v_data jsonb := p_data;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_job from public.documentary_jobs where id = p_job_id for update;
  if not found then
    insert into public.documentary_jobs (id, user_id, status, data, billing_enabled, created_at, updated_at)
    values (p_job_id, p_user_id, p_status, p_data, p_billing_enabled, p_created_at, now()) returning * into v_job;
    return v_job.data;
  end if;
  if v_job.user_id <> p_user_id then raise exception 'Job owner cannot change'; end if;
  if v_job.cancellation_requested_at is not null then
    v_data := jsonb_set(jsonb_set(jsonb_set(p_data, '{status}', '"cancelled"'::jsonb), '{progress,stage}', '"cancelled"'::jsonb), '{cancelRequestedAt}', to_jsonb(v_job.cancellation_requested_at::text));
  end if;
  update public.documentary_jobs
    set status = case when cancellation_requested_at is not null then 'cancelled' else p_status end,
      data = v_data, billing_enabled = billing_enabled or p_billing_enabled, updated_at = now()
    where id = p_job_id returning * into v_job;
  return v_job.data;
end;
$$;

create or replace function public.cancel_documentary_job_v1(p_job_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_job public.documentary_jobs; v_data jsonb; v_billing_status text; v_now timestamptz := now();
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_job from public.documentary_jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.status in ('completed', 'failed', 'cancelled') then return v_job.data; end if;
  select status into v_billing_status from public.job_credit_reservations where job_id = p_job_id;
  if v_billing_status = 'settled' then
    v_data := jsonb_set(jsonb_set(v_job.data, '{status}', '"completed"'::jsonb), '{progress,stage}', '"completed"'::jsonb);
    update public.documentary_jobs set status = 'completed', data = v_data, updated_at = v_now where id = p_job_id returning * into v_job;
    return v_job.data;
  end if;
  v_data := jsonb_set(jsonb_set(jsonb_set(v_job.data, '{status}', '"cancelled"'::jsonb), '{progress,stage}', '"cancelled"'::jsonb), '{cancelRequestedAt}', to_jsonb(v_now::text));
  update public.documentary_jobs set status = 'cancelled', data = v_data, cancellation_requested_at = v_now, updated_at = v_now
    where id = p_job_id returning * into v_job;
  return v_job.data;
end;
$$;

create or replace function public.resume_documentary_job_v1(p_job_id text, p_user_id uuid, p_status text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_job public.documentary_jobs;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_job from public.documentary_jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.user_id <> p_user_id then raise exception 'Job owner cannot change'; end if;
  update public.documentary_jobs set status = p_status, data = p_data - 'cancelRequestedAt', cancellation_requested_at = null, updated_at = now()
    where id = p_job_id returning * into v_job;
  return v_job.data;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Stage accounting functions are defined below.

drop function if exists public.reserve_job_credits(uuid, integer);
drop function if exists public.release_job_credits(uuid, integer);
drop function if exists public.charge_job_credits(uuid, integer, text, text);

alter table public.profiles enable row level security;
alter table public.documentary_jobs enable row level security;
alter table public.job_credit_reservations enable row level security;
alter table public.job_credit_consumptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.saas_settings enable row level security;
alter table public.testimonials enable row level security;
revoke all on table public.job_credit_reservations from anon, authenticated;
revoke all on table public.job_credit_consumptions from anon, authenticated;

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

create or replace function public.reserve_job_credits_v1(
  p_job_id text, p_user_id uuid, p_total_credits integer, p_script_credits integer,
  p_image_credits integer, p_narration_credits integer, p_video_credits integer, p_scene_count integer
)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles; v_reservation public.job_credit_reservations;
  v_total integer := p_total_credits; v_script integer := p_script_credits;
  v_images integer := p_image_credits; v_narration integer := p_narration_credits; v_video integer := p_video_credits;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_job_id is null or p_job_id = '' or p_scene_count <= 0 then raise exception 'Invalid billing reservation'; end if;
  if least(p_total_credits, p_script_credits, p_image_credits, p_narration_credits, p_video_credits) < 0
     or p_script_credits + p_image_credits + p_narration_credits + p_video_credits <> p_total_credits then raise exception 'Invalid stage allocations'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if found then
    if v_reservation.user_id <> p_user_id
       or (v_reservation.total_credits <> p_total_credits and v_reservation.total_credits <> 0)
       or v_reservation.scene_count <> p_scene_count then raise exception 'Reservation parameters do not match existing job'; end if;
    return v_reservation;
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if found then
    if v_reservation.user_id <> p_user_id
       or (v_reservation.total_credits <> p_total_credits and v_reservation.total_credits <> 0)
       or v_reservation.scene_count <> p_scene_count then raise exception 'Reservation parameters do not match existing job'; end if;
    return v_reservation;
  end if;
  if v_profile.role = 'admin' then
    v_total := 0; v_script := 0; v_images := 0; v_narration := 0; v_video := 0;
  elsif v_profile.credits - v_profile.reserved_credits < v_total then
    raise exception 'Insufficient credits. You need % available credits, but you currently have %.', v_total, v_profile.credits - v_profile.reserved_credits;
  end if;
  insert into public.job_credit_reservations (
    job_id, user_id, total_credits, reserved_credits, script_credits, image_credits, narration_credits, video_credits, scene_count
  ) values (p_job_id, p_user_id, v_total, v_total, v_script, v_images, v_narration, v_video, p_scene_count)
  returning * into v_reservation;
  if v_total > 0 then update public.profiles set reserved_credits = reserved_credits + v_total, updated_at = now() where id = p_user_id; end if;
  return v_reservation;
end;
$$;

create or replace function public.set_job_billing_scene_count_v1(p_job_id text, p_scene_count integer)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_scene_count <= 0 then raise exception 'Scene count must be positive'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.scene_count = p_scene_count then return v_reservation; end if;
  if exists (select 1 from public.job_credit_consumptions where job_id = p_job_id and stage in ('images', 'narration', 'video')) then
    raise exception 'Scene count is locked after scene work begins';
  end if;
  update public.job_credit_reservations set scene_count = p_scene_count, updated_at = now() where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.consume_job_credits_v1(p_job_id text, p_stage text, p_scene_number integer default null)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations; v_profile public.profiles;
  v_key text; v_allocation integer; v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_stage not in ('script', 'images', 'narration', 'video') then raise exception 'Invalid billing stage'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if p_stage = 'script' then
    if p_scene_number is not null then raise exception 'Script consumption cannot have a scene'; end if;
    v_key := 'script'; v_allocation := v_reservation.script_credits; v_amount := v_allocation;
  else
    if p_scene_number is null or p_scene_number < 1 or p_scene_number > v_reservation.scene_count then raise exception 'Invalid scene number for billing'; end if;
    v_key := p_stage || ':scene:' || lpad(p_scene_number::text, 4, '0');
    v_allocation := case p_stage when 'images' then v_reservation.image_credits when 'narration' then v_reservation.narration_credits else v_reservation.video_credits end;
    v_amount := (p_scene_number * v_allocation) / v_reservation.scene_count - ((p_scene_number - 1) * v_allocation) / v_reservation.scene_count;
  end if;
  if exists (select 1 from public.job_credit_consumptions where job_id = p_job_id and consumption_key = v_key) then return v_reservation; end if;
  if v_reservation.status <> 'active' then raise exception 'Job credit reservation is not active'; end if;
  if v_reservation.reserved_credits < v_amount then raise exception 'Reserved credit consumption exceeds remaining reservation'; end if;
  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_profile.role <> 'admin' and (v_profile.credits < v_amount or v_profile.reserved_credits < v_amount) then raise exception 'Reserved credit charge failed'; end if;
  insert into public.job_credit_consumptions (job_id, consumption_key, stage, scene_number, amount)
  values (p_job_id, v_key, p_stage, p_scene_number, v_amount);
  if v_amount > 0 and v_profile.role <> 'admin' then
    update public.profiles set credits = credits - v_amount, reserved_credits = reserved_credits - v_amount, updated_at = now()
      where id = v_profile.id returning * into v_profile;
    insert into public.credit_ledger (id, user_id, amount, balance_after, type, description, reference_id)
    values ('credit_generation_' || md5(p_job_id || ':' || v_key), v_profile.id, -v_amount, v_profile.credits, 'generation', 'Production stage: ' || replace(v_key, ':', ' '), p_job_id)
    on conflict (id) do nothing;
  end if;
  update public.job_credit_reservations
    set consumed_credits = consumed_credits + v_amount, reserved_credits = reserved_credits - v_amount, updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.resume_job_credits_v1(p_job_id text)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations; v_profile public.profiles; v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.status in ('active', 'settled') then return v_reservation; end if;
  v_amount := v_reservation.total_credits - v_reservation.consumed_credits;
  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_profile.role <> 'admin' and v_profile.credits - v_profile.reserved_credits < v_amount then
    raise exception 'Insufficient credits. You need % available credits, but you currently have %.', v_amount, v_profile.credits - v_profile.reserved_credits;
  end if;
  if v_amount > 0 and v_profile.role <> 'admin' then update public.profiles set reserved_credits = reserved_credits + v_amount, updated_at = now() where id = v_profile.id; end if;
  update public.job_credit_reservations set status = 'active', reserved_credits = v_amount, released_at = null, updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.get_job_credits_v1(p_job_id text)
returns public.job_credit_reservations language plpgsql stable security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id;
  if not found then raise exception 'Job credit reservation not found'; end if;
  return v_reservation;
end;
$$;

create or replace function public.release_job_credits_v1(p_job_id text)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations; v_profile public.profiles;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.status in ('released', 'settled') then return v_reservation; end if;
  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if v_reservation.reserved_credits > 0 and v_profile.role <> 'admin' then
    update public.profiles set reserved_credits = greatest(0, reserved_credits - v_reservation.reserved_credits), updated_at = now() where id = v_profile.id;
  end if;
  update public.job_credit_reservations set status = 'released', reserved_credits = 0, released_at = now(), updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.settle_job_credits_v1(p_job_id text)
returns public.job_credit_reservations language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations; v_profile public.profiles;
  v_script integer; v_images integer; v_narration integer; v_video integer; v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.status = 'settled' then return v_reservation; end if;
  if v_reservation.status <> 'active' then raise exception 'Job credit reservation is not active'; end if;
  select coalesce(sum(amount) filter (where stage = 'script'), 0), coalesce(sum(amount) filter (where stage = 'images'), 0),
    coalesce(sum(amount) filter (where stage = 'narration'), 0), coalesce(sum(amount) filter (where stage = 'video'), 0)
    into v_script, v_images, v_narration, v_video from public.job_credit_consumptions where job_id = p_job_id;
  if v_script <> v_reservation.script_credits or v_images <> v_reservation.image_credits or v_narration <> v_reservation.narration_credits then
    raise exception 'Cannot settle before all non-video stages are durably consumed';
  end if;
  v_amount := v_reservation.video_credits - v_video;
  if v_amount < 0 or v_reservation.reserved_credits <> v_amount then raise exception 'Video settlement does not match remaining reservation'; end if;
  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_amount > 0 and v_profile.role <> 'admin' then
    if v_profile.credits < v_amount or v_profile.reserved_credits < v_amount then raise exception 'Reserved credit charge failed'; end if;
    update public.profiles set credits = credits - v_amount, reserved_credits = reserved_credits - v_amount,
      total_documentaries_created = total_documentaries_created + 1, updated_at = now()
      where id = v_profile.id returning * into v_profile;
    insert into public.credit_ledger (id, user_id, amount, balance_after, type, description, reference_id)
    values ('credit_generation_' || md5(p_job_id || ':video:final-render'), v_profile.id, -v_amount, v_profile.credits, 'generation', 'Production stage: final video render', p_job_id)
    on conflict (id) do nothing;
  else
    update public.profiles set total_documentaries_created = total_documentaries_created + 1, updated_at = now() where id = v_profile.id;
  end if;
  insert into public.job_credit_consumptions (job_id, consumption_key, stage, scene_number, amount)
    values (p_job_id, 'video:final-render', 'video', null, v_amount) on conflict (job_id, consumption_key) do nothing;
  update public.job_credit_reservations set status = 'settled', consumed_credits = total_credits, reserved_credits = 0,
    settled_at = now(), updated_at = now() where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

revoke all on function public.reserve_job_credits_v1(text, uuid, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.set_job_billing_scene_count_v1(text, integer) from public, anon, authenticated;
revoke all on function public.consume_job_credits_v1(text, text, integer) from public, anon, authenticated;
revoke all on function public.get_job_credits_v1(text) from public, anon, authenticated;
revoke all on function public.resume_job_credits_v1(text) from public, anon, authenticated;
revoke all on function public.release_job_credits_v1(text) from public, anon, authenticated;
revoke all on function public.settle_job_credits_v1(text) from public, anon, authenticated;
revoke all on function public.save_documentary_job_v1(text, uuid, text, jsonb, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.cancel_documentary_job_v1(text) from public, anon, authenticated;
revoke all on function public.resume_documentary_job_v1(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_job_credits_v1(text, uuid, integer, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.set_job_billing_scene_count_v1(text, integer) to service_role;
grant execute on function public.consume_job_credits_v1(text, text, integer) to service_role;
grant execute on function public.get_job_credits_v1(text) to service_role;
grant execute on function public.resume_job_credits_v1(text) to service_role;
grant execute on function public.release_job_credits_v1(text) to service_role;
grant execute on function public.settle_job_credits_v1(text) to service_role;
grant execute on function public.save_documentary_job_v1(text, uuid, text, jsonb, timestamptz, boolean) to service_role;
grant execute on function public.cancel_documentary_job_v1(text) to service_role;
grant execute on function public.resume_documentary_job_v1(text, uuid, text, jsonb) to service_role;

create or replace function public.claim_documentary_job_lease_v1(p_job_id text, p_lease_id text, p_lease_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if length(coalesce(p_lease_id, '')) not between 16 and 100 or p_lease_seconds not between 60 and 7200 then raise exception 'Invalid worker lease'; end if;
  update public.documentary_jobs set worker_lease_id = p_lease_id,
    worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    where id = p_job_id and (worker_lease_id is null or worker_lease_expires_at < now() or worker_lease_id = p_lease_id);
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
create or replace function public.release_documentary_job_lease_v1(p_job_id text, p_lease_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  update public.documentary_jobs set worker_lease_id = null, worker_lease_expires_at = null, updated_at = now()
    where id = p_job_id and worker_lease_id = p_lease_id;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.claim_documentary_job_lease_v1(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_documentary_job_lease_v1(text, text) from public, anon, authenticated;
grant execute on function public.claim_documentary_job_lease_v1(text, text, integer) to service_role;
grant execute on function public.release_documentary_job_lease_v1(text, text) to service_role;

-- Distributed API rate limiting.
create table if not exists public.security_rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start)
);
alter table public.security_rate_limits enable row level security;
create index if not exists security_rate_limits_window_start_idx on public.security_rate_limits(window_start);
revoke all on table public.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, retry_after integer)
language plpgsql security definer set search_path = public
as $$
declare v_now timestamptz := clock_timestamp(); v_window_start timestamptz; v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if length(coalesce(p_key, '')) not between 1 and 200 or p_limit < 1 or p_window_seconds not between 1 and 86400 then raise exception 'Invalid rate limit'; end if;
  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  insert into public.security_rate_limits(bucket_key, window_start, request_count, updated_at)
  values (p_key, v_window_start, 1, v_now)
  on conflict (bucket_key, window_start) do update set request_count = public.security_rate_limits.request_count + 1, updated_at = excluded.updated_at
  returning request_count into v_count;
  return query select v_count <= p_limit, greatest(0, p_limit - v_count),
    greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Atomic payment completion and webhook replay protection.
create unique index if not exists idx_payment_gateway_reference_unique on public.payment_transactions(gateway, payment_id) where payment_id is not null;
create unique index if not exists idx_payment_gateway_provider_unique on public.payment_transactions(gateway, provider_payment_id) where provider_payment_id is not null;
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
  if p_gateway not in ('dodo', 'stripe', 'razorpay') or length(coalesce(p_event_id, '')) not between 1 and 200 then raise exception 'Invalid webhook event'; end if;
  insert into public.payment_webhook_events(gateway, event_id) values (p_gateway, p_event_id) on conflict do nothing;
  return found;
end;
$$;

create or replace function public.complete_payment_transaction_v1(p_transaction_id text, p_provider_payment_id text default null)
returns public.payment_transactions language plpgsql security definer set search_path = public
as $$
declare v_transaction public.payment_transactions; v_profile public.profiles;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_transaction from public.payment_transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_transaction.status = 'completed' then return v_transaction; end if;
  if v_transaction.status <> 'pending' or v_transaction.credits_added <= 0 then raise exception 'Transaction cannot be completed'; end if;
  select * into v_profile from public.profiles where id = v_transaction.user_id for update;
  if not found then raise exception 'User not found'; end if;
  update public.profiles set credits = credits + v_transaction.credits_added, updated_at = now() where id = v_profile.id returning * into v_profile;
  update public.payment_transactions set status = 'completed', provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
    where id = v_transaction.id returning * into v_transaction;
  insert into public.credit_ledger(id, user_id, amount, balance_after, type, description, reference_id)
  values ('credit_purchase_' || md5(v_transaction.id), v_transaction.user_id, v_transaction.credits_added, v_profile.credits, 'purchase', v_transaction.pack_name || ' credit purchase', v_transaction.id);
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
