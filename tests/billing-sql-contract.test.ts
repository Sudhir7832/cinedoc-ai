import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function migration(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'data', name), 'utf8').toLowerCase();
}

test('billing migration enforces job-scoped idempotent consumption and server-only RPCs', () => {
  const sql = migration('supabase-billing-v1-migration.sql');
  assert.match(sql, /unique \(job_id, consumption_key\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(sql, /revoke all on function public\.consume_job_credits_v1/);
  assert.match(sql, /consumed_credits \+ reserved_credits <= total_credits/);
});

test('payment migration is replay-safe and atomically credits a locked profile', () => {
  const sql = migration('supabase-payment-integrity-migration.sql');
  assert.match(sql, /primary key \(gateway, event_id\)/);
  assert.match(sql, /where id = p_transaction_id for update/);
  assert.match(sql, /where id = v_transaction\.user_id for update/);
  assert.match(sql, /if v_transaction\.status = 'completed' then return v_transaction/);
  assert.match(sql, /grant execute on function public\.complete_payment_transaction_v1.*service_role/);
});

test('job execution lease prevents concurrent workers', () => {
  const sql = migration('supabase-job-lease-migration.sql');
  assert.match(sql, /worker_lease_expires_at < now\(\)/);
  assert.match(sql, /worker_lease_id = p_lease_id/);
  assert.match(sql, /revoke all on function public\.claim_documentary_job_lease_v1/);
  assert.match(sql, /p_lease_seconds not between 60 and 7200/);
});
