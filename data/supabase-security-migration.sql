begin;

create table if not exists public.security_rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start)
);

alter table public.security_rate_limits enable row level security;
create index if not exists security_rate_limits_window_start_idx on public.security_rate_limits (window_start);
revoke all on table public.security_rate_limits from public, anon, authenticated;
grant all on table public.security_rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;
  if length(p_key) < 1 or length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  insert into public.security_rate_limits (bucket_key, window_start, request_count, updated_at)
  values (p_key, v_window_start, 1, v_now)
  on conflict (bucket_key, window_start) do update
    set request_count = public.security_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_count;

  return query select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

delete from public.security_rate_limits where window_start < now() - interval '2 days';

commit;
