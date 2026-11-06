import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowedOutboundUrl } from '../src/lib/security/outbound-url';

test('outbound URLs require HTTPS and an allowlisted host', () => {
  assert.equal(assertAllowedOutboundUrl('https://checkout.stripe.com/session', ['stripe.com']).hostname, 'checkout.stripe.com');
  assert.throws(() => assertAllowedOutboundUrl('http://stripe.com/session', ['stripe.com']));
  assert.throws(() => assertAllowedOutboundUrl('https://stripe.com.evil.example/session', ['stripe.com']));
  assert.throws(() => assertAllowedOutboundUrl('https://127.0.0.1/internal', ['127.0.0.1']));
  assert.throws(() => assertAllowedOutboundUrl('https://user:pass@stripe.com/session', ['stripe.com']));
});
