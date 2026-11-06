import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getCanonicalOrigin, requireSameOrigin } from '../src/lib/security/origin';

function request(origin: string, host = 'kinesisflow.example') {
  return new NextRequest(`https://${host}/api/jobs`, {
    method: 'POST',
    headers: { host, origin, 'x-forwarded-proto': 'https' },
  });
}

test('same-origin mutations pass and foreign origins fail', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://kinesisflow.example';
  try {
    assert.doesNotThrow(() => requireSameOrigin(request('https://kinesisflow.example')));
    assert.throws(() => requireSameOrigin(request('https://evil.example')), /Cross-origin/);
    assert.throws(() => getCanonicalOrigin(request('https://kinesisflow.example', 'poisoned.example')), /Invalid request host/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
