import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentVerifySchema, dodoWebhookSchema } from '../src/lib/security/schemas';

test('paymentVerifySchema handles dodo gateway with empty or missing optional fields', () => {
  const result1 = paymentVerifySchema.safeParse({
    gateway: 'dodo',
    transaction_id: 'tx_1794029474404_74228d',
  });
  assert.equal(result1.success, true);
  if (result1.success) {
    assert.equal(result1.data.gateway, 'dodo');
    assert.equal(result1.data.transaction_id, 'tx_1794029474404_74228d');
  }

  // Handles empty strings gracefully without throwing validation error
  const result2 = paymentVerifySchema.safeParse({
    gateway: 'dodo',
    session_id: '',
    payment_id: '',
    transaction_id: 'tx_1794029474404_74228d',
  });
  assert.equal(result2.success, true);
  if (result2.success) {
    assert.equal(result2.data.gateway, 'dodo');
    assert.equal(result2.data.transaction_id, 'tx_1794029474404_74228d');
    assert.equal(result2.data.session_id, undefined);
    assert.equal(result2.data.payment_id, undefined);
  }

  // Accepts session_id alone
  const result3 = paymentVerifySchema.safeParse({
    gateway: 'dodo',
    session_id: 'cks_0NrPThCGYG6pfuDDloT8l',
  });
  assert.equal(result3.success, true);
  if (result3.success) {
    assert.equal(result3.data.gateway, 'dodo');
    assert.equal(result3.data.session_id, 'cks_0NrPThCGYG6pfuDDloT8l');
  }

  // Accepts payment_id alone
  const result4 = paymentVerifySchema.safeParse({
    gateway: 'dodo',
    payment_id: 'pay_0NrPTmIfrn7RsvMt05zxT',
  });
  assert.equal(result4.success, true);
  if (result4.success) {
    assert.equal(result4.data.gateway, 'dodo');
    assert.equal(result4.data.payment_id, 'pay_0NrPTmIfrn7RsvMt05zxT');
  }
});

test('dodoWebhookSchema handles standard and extended Dodo webhook structures', () => {
  const payload = {
    type: 'payment.succeeded',
    data: {
      payment_id: 'pay_0NrPTmIfrn7RsvMt05zxT',
      checkout_session_id: 'cks_0NrPThCGYG6pfuDDloT8l',
      status: 'succeeded',
      metadata: {
        transaction_id: 'tx_1794029474404_74228d',
        credits: 150,
        user_id: 'user_123',
        pack_id: 'pack_creator',
      },
    },
  };
  const parsed = dodoWebhookSchema.safeParse(payload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.type, 'payment.succeeded');
    assert.equal(parsed.data.data?.payment_id, 'pay_0NrPTmIfrn7RsvMt05zxT');
    assert.equal(parsed.data.data?.checkout_session_id, 'cks_0NrPThCGYG6pfuDDloT8l');
  }
});

