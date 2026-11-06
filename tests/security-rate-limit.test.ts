import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeLocalRateLimit } from '../src/lib/security/rate-limit';

test('local fallback limiter enforces and resets a fixed window', () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  assert.equal(consumeLocalRateLimit(key, 2, 60, 1_000).allowed, true);
  assert.equal(consumeLocalRateLimit(key, 2, 60, 2_000).allowed, true);
  assert.equal(consumeLocalRateLimit(key, 2, 60, 3_000).allowed, false);
  assert.equal(consumeLocalRateLimit(key, 2, 60, 62_000).allowed, true);
});
