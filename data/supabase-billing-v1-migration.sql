-- Stage-based, idempotent job billing v1.
-- Apply once after data/supabase-schema.sql on existing installations.

begin;

alter table public.documentary_jobs
  add column if not exists billing_enabled boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz;

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
  constraint job_credit_allocations_total check (
    script_credits + image_credits + narration_credits + video_credits = total_credits
  ),
  constraint job_credit_accounted_total check (
    consumed_credits + reserved_credits <= total_credits
  )
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
  check (
    (stage = 'script' and scene_number is null)
    or (stage <> 'script' and scene_number is not null)
    or (stage = 'video' and consumption_key = 'video:final-render' and scene_number is null)
  )
);
create index if not exists idx_job_credit_consumptions_job on public.job_credit_consumptions(job_id, stage);

alter table public.job_credit_reservations enable row level security;
alter table public.job_credit_consumptions enable row level security;
revoke all on table public.job_credit_reservations from anon, authenticated;
revoke all on table public.job_credit_consumptions from anon, authenticated;

-- Legacy JSON jobs intentionally receive no reservation rows. Rebuild the aggregate
-- from v1 rows, which releases legacy holds and remains safe if this script is rerun.
update public.profiles p
set reserved_credits = coalesce((
  select sum(r.reserved_credits)
  from public.job_credit_reservations r
  where r.user_id = p.id and r.status = 'active'
), 0), updated_at = now()
where p.reserved_credits <> coalesce((
  select sum(r.reserved_credits)
  from public.job_credit_reservations r
  where r.user_id = p.id and r.status = 'active'
), 0);

drop function if exists public.reserve_job_credits(uuid, integer);
drop function if exists public.release_job_credits(uuid, integer);
drop function if exists public.charge_job_credits(uuid, integer, text, text);

create or replace function public.reserve_job_credits_v1(
  p_job_id text,
  p_user_id uuid,
  p_total_credits integer,
  p_script_credits integer,
  p_image_credits integer,
  p_narration_credits integer,
  p_video_credits integer,
  p_scene_count integer
)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_reservation public.job_credit_reservations;
  v_total integer := p_total_credits;
  v_script integer := p_script_credits;
  v_images integer := p_image_credits;
  v_narration integer := p_narration_credits;
  v_video integer := p_video_credits;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_job_id is null or p_job_id = '' or p_scene_count <= 0 then raise exception 'Invalid billing reservation'; end if;
  if least(p_total_credits, p_script_credits, p_image_credits, p_narration_credits, p_video_credits) < 0
     or p_script_credits + p_image_credits + p_narration_credits + p_video_credits <> p_total_credits then
    raise exception 'Invalid stage allocations';
  end if;

  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if found then
    if v_reservation.user_id <> p_user_id
       or (v_reservation.total_credits <> p_total_credits and v_reservation.total_credits <> 0)
       or v_reservation.scene_count <> p_scene_count then
      raise exception 'Reservation parameters do not match existing job';
    end if;
    return v_reservation;
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if found then
    if v_reservation.user_id <> p_user_id
       or (v_reservation.total_credits <> p_total_credits and v_reservation.total_credits <> 0)
       or v_reservation.scene_count <> p_scene_count then
      raise exception 'Reservation parameters do not match existing job';
    end if;
    return v_reservation;
  end if;
  if v_profile.role = 'admin' then
    v_total := 0; v_script := 0; v_images := 0; v_narration := 0; v_video := 0;
  elsif v_profile.credits - v_profile.reserved_credits < v_total then
    raise exception 'Insufficient credits. You need % available credits, but you currently have %.', v_total, v_profile.credits - v_profile.reserved_credits;
  end if;

  insert into public.job_credit_reservations (
    job_id, user_id, total_credits, reserved_credits, script_credits,
    image_credits, narration_credits, video_credits, scene_count
  ) values (
    p_job_id, p_user_id, v_total, v_total, v_script,
    v_images, v_narration, v_video, p_scene_count
  ) returning * into v_reservation;

  if v_total > 0 then
    update public.profiles
      set reserved_credits = reserved_credits + v_total, updated_at = now()
      where id = p_user_id;
  end if;
  return v_reservation;
end;
$$;

create or replace function public.set_job_billing_scene_count_v1(p_job_id text, p_scene_count integer)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_scene_count <= 0 then raise exception 'Scene count must be positive'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.scene_count = p_scene_count then return v_reservation; end if;
  if exists (
    select 1 from public.job_credit_consumptions
    where job_id = p_job_id and stage in ('images', 'narration', 'video')
  ) then raise exception 'Scene count is locked after scene work begins'; end if;
  update public.job_credit_reservations set scene_count = p_scene_count, updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.consume_job_credits_v1(p_job_id text, p_stage text, p_scene_number integer default null)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations;
  v_profile public.profiles;
  v_key text;
  v_allocation integer;
  v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if p_stage not in ('script', 'images', 'narration', 'video') then raise exception 'Invalid billing stage'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;

  if p_stage = 'script' then
    if p_scene_number is not null then raise exception 'Script consumption cannot have a scene'; end if;
    v_key := 'script';
    v_allocation := v_reservation.script_credits;
    v_amount := v_allocation;
  else
    if p_scene_number is null or p_scene_number < 1 or p_scene_number > v_reservation.scene_count then
      raise exception 'Invalid scene number for billing';
    end if;
    v_key := p_stage || ':scene:' || lpad(p_scene_number::text, 4, '0');
    v_allocation := case p_stage
      when 'images' then v_reservation.image_credits
      when 'narration' then v_reservation.narration_credits
      else v_reservation.video_credits
    end;
    v_amount := (p_scene_number * v_allocation) / v_reservation.scene_count
      - ((p_scene_number - 1) * v_allocation) / v_reservation.scene_count;
  end if;

  if exists (select 1 from public.job_credit_consumptions where job_id = p_job_id and consumption_key = v_key) then
    return v_reservation;
  end if;
  if v_reservation.status <> 'active' then raise exception 'Job credit reservation is not active'; end if;
  if v_reservation.reserved_credits < v_amount then raise exception 'Reserved credit consumption exceeds remaining reservation'; end if;

  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_profile.role <> 'admin' and (v_profile.credits < v_amount or v_profile.reserved_credits < v_amount) then
    raise exception 'Reserved credit charge failed';
  end if;

  insert into public.job_credit_consumptions (job_id, consumption_key, stage, scene_number, amount)
  values (p_job_id, v_key, p_stage, p_scene_number, v_amount);

  if v_amount > 0 and v_profile.role <> 'admin' then
    update public.profiles
      set credits = credits - v_amount, reserved_credits = reserved_credits - v_amount, updated_at = now()
      where id = v_profile.id returning * into v_profile;
    insert into public.credit_ledger (id, user_id, amount, balance_after, type, description, reference_id)
    values (
      'credit_generation_' || md5(p_job_id || ':' || v_key), v_profile.id, -v_amount,
      v_profile.credits, 'generation', 'Production stage: ' || replace(v_key, ':', ' '), p_job_id
    ) on conflict (id) do nothing;
  end if;

  update public.job_credit_reservations
    set consumed_credits = consumed_credits + v_amount,
        reserved_credits = reserved_credits - v_amount,
        updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.get_job_credits_v1(p_job_id text)
returns public.job_credit_reservations
language plpgsql stable security definer set search_path = public
as $$
declare v_reservation public.job_credit_reservations;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id;
  if not found then raise exception 'Job credit reservation not found'; end if;
  return v_reservation;
end;
$$;

create or replace function public.resume_job_credits_v1(p_job_id text)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations;
  v_profile public.profiles;
  v_amount integer;
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
  if v_amount > 0 and v_profile.role <> 'admin' then
    update public.profiles set reserved_credits = reserved_credits + v_amount, updated_at = now() where id = v_profile.id;
  end if;
  update public.job_credit_reservations
    set status = 'active', reserved_credits = v_amount, released_at = null, updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.release_job_credits_v1(p_job_id text)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations;
  v_profile public.profiles;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.status in ('released', 'settled') then return v_reservation; end if;
  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if v_reservation.reserved_credits > 0 and v_profile.role <> 'admin' then
    update public.profiles
      set reserved_credits = greatest(0, reserved_credits - v_reservation.reserved_credits), updated_at = now()
      where id = v_profile.id;
  end if;
  update public.job_credit_reservations
    set status = 'released', reserved_credits = 0, released_at = now(), updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.settle_job_credits_v1(p_job_id text)
returns public.job_credit_reservations
language plpgsql security definer set search_path = public
as $$
declare
  v_reservation public.job_credit_reservations;
  v_profile public.profiles;
  v_script integer;
  v_images integer;
  v_narration integer;
  v_video integer;
  v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_reservation from public.job_credit_reservations where job_id = p_job_id for update;
  if not found then raise exception 'Job credit reservation not found'; end if;
  if v_reservation.status = 'settled' then return v_reservation; end if;
  if v_reservation.status <> 'active' then raise exception 'Job credit reservation is not active'; end if;

  select
    coalesce(sum(amount) filter (where stage = 'script'), 0),
    coalesce(sum(amount) filter (where stage = 'images'), 0),
    coalesce(sum(amount) filter (where stage = 'narration'), 0),
    coalesce(sum(amount) filter (where stage = 'video'), 0)
  into v_script, v_images, v_narration, v_video
  from public.job_credit_consumptions where job_id = p_job_id;
  if v_script <> v_reservation.script_credits
     or v_images <> v_reservation.image_credits
     or v_narration <> v_reservation.narration_credits then
    raise exception 'Cannot settle before all non-video stages are durably consumed';
  end if;
  v_amount := v_reservation.video_credits - v_video;
  if v_amount < 0 or v_reservation.reserved_credits <> v_amount then
    raise exception 'Video settlement does not match remaining reservation';
  end if;

  select * into v_profile from public.profiles where id = v_reservation.user_id for update;
  if not found then raise exception 'User not found'; end if;
  if v_amount > 0 and v_profile.role <> 'admin' then
    if v_profile.credits < v_amount or v_profile.reserved_credits < v_amount then raise exception 'Reserved credit charge failed'; end if;
    update public.profiles
      set credits = credits - v_amount,
          reserved_credits = reserved_credits - v_amount,
          total_documentaries_created = total_documentaries_created + 1,
          updated_at = now()
      where id = v_profile.id returning * into v_profile;
    insert into public.credit_ledger (id, user_id, amount, balance_after, type, description, reference_id)
    values (
      'credit_generation_' || md5(p_job_id || ':video:final-render'), v_profile.id, -v_amount,
      v_profile.credits, 'generation', 'Production stage: final video render', p_job_id
    ) on conflict (id) do nothing;
  else
    update public.profiles
      set total_documentaries_created = total_documentaries_created + 1, updated_at = now()
      where id = v_profile.id;
  end if;
  insert into public.job_credit_consumptions (job_id, consumption_key, stage, scene_number, amount)
  values (p_job_id, 'video:final-render', 'video', null, v_amount)
  on conflict (job_id, consumption_key) do nothing;
  update public.job_credit_reservations
    set status = 'settled', consumed_credits = total_credits, reserved_credits = 0,
        settled_at = now(), updated_at = now()
    where job_id = p_job_id returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.save_documentary_job_v1(
  p_job_id text, p_user_id uuid, p_status text, p_data jsonb,
  p_created_at timestamptz, p_billing_enabled boolean
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_job public.documentary_jobs;
  v_data jsonb := p_data;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_job from public.documentary_jobs where id = p_job_id for update;
  if not found then
    insert into public.documentary_jobs (id, user_id, status, data, billing_enabled, created_at, updated_at)
    values (p_job_id, p_user_id, p_status, p_data, p_billing_enabled, p_created_at, now())
    returning * into v_job;
    return v_job.data;
  end if;
  if v_job.user_id <> p_user_id then raise exception 'Job owner cannot change'; end if;
  if v_job.cancellation_requested_at is not null then
    v_data := jsonb_set(jsonb_set(jsonb_set(p_data, '{status}', '"cancelled"'::jsonb), '{progress,stage}', '"cancelled"'::jsonb), '{cancelRequestedAt}', to_jsonb(v_job.cancellation_requested_at::text));
  end if;
  update public.documentary_jobs
    set status = case when cancellation_requested_at is not null then 'cancelled' else p_status end,
        data = v_data,
        billing_enabled = billing_enabled or p_billing_enabled,
        updated_at = now()
    where id = p_job_id returning * into v_job;
  return v_job.data;
end;
$$;

create or replace function public.cancel_documentary_job_v1(p_job_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_job public.documentary_jobs;
  v_data jsonb;
  v_billing_status text;
  v_now timestamptz := now();
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
  update public.documentary_jobs
    set status = 'cancelled', data = v_data, cancellation_requested_at = v_now, updated_at = v_now
    where id = p_job_id returning * into v_job;
  return v_job.data;
end;
$$;

create or replace function public.resume_documentary_job_v1(
  p_job_id text, p_user_id uuid, p_status text, p_data jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_job public.documentary_jobs;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_job from public.documentary_jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if v_job.user_id <> p_user_id then raise exception 'Job owner cannot change'; end if;
  update public.documentary_jobs
    set status = p_status, data = p_data - 'cancelRequestedAt', cancellation_requested_at = null, updated_at = now()
    where id = p_job_id returning * into v_job;
  return v_job.data;
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

commit;
