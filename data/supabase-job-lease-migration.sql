begin;
alter table public.documentary_jobs
  add column if not exists worker_lease_id text,
  add column if not exists worker_lease_expires_at timestamptz;

create or replace function public.claim_documentary_job_lease_v1(p_job_id text, p_lease_id text, p_lease_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if length(coalesce(p_lease_id, '')) not between 16 and 100 or p_lease_seconds not between 60 and 7200 then raise exception 'Invalid worker lease'; end if;
  update public.documentary_jobs
    set worker_lease_id = p_lease_id,
        worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = p_job_id
      and (worker_lease_id is null or worker_lease_expires_at < now() or worker_lease_id = p_lease_id);
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
commit;
