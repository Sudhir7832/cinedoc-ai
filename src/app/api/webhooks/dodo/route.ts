import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { DbManager } from '@/lib/db';
import { rateLimit } from '@/lib/security/rate-limit';
import { readBodyText } from '@/lib/security/request';
import { dodoWebhookSchema } from '@/lib/security/schemas';

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { bucket: 'webhook-dodo', limit: 120, windowSeconds: 60, failClosed: true });
  if (limited) return limited;
  const settings = await DbManager.getSettings();
  if (!settings.dodoWebhookKey) return NextResponse.json({ error: 'Webhook unavailable.' }, { status: 503 });

  let rawBody: string;
  try {
    rawBody = await readBodyText(req, 256 * 1024);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }
  const headers = {
    'webhook-id': req.headers.get('webhook-id') || '',
    'webhook-signature': req.headers.get('webhook-signature') || '',
    'webhook-timestamp': req.headers.get('webhook-timestamp') || '',
  };
  try {
    await new Webhook(settings.dodoWebhookKey).verify(rawBody, headers);
  } catch {
    return NextResponse.json({ error: 'Invalid Dodo webhook signature.' }, { status: 400 });
  }
  let payload;
  try {
    const rawPayload: unknown = JSON.parse(rawBody);
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) throw new Error('Invalid payload.');
    const incoming = rawPayload as Record<string, unknown>;
    const incomingData = incoming.data && typeof incoming.data === 'object' && !Array.isArray(incoming.data)
      ? incoming.data as Record<string, unknown>
      : undefined;
    payload = dodoWebhookSchema.parse({
      type: incoming.type,
      data: incomingData ? {
        payment_id: incomingData.payment_id,
        metadata: incomingData.metadata,
      } : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }
  const transactionId = String(payload.data?.metadata?.transaction_id || '');
  if (!transactionId) return NextResponse.json({ received: true });
  const transaction = await DbManager.getTransactionById(transactionId);
  if (!transaction || transaction.gateway !== 'dodo') return NextResponse.json({ received: true });
  const metadata = payload.data?.metadata;
  if (String(metadata?.user_id || '') !== transaction.userId
    || String(metadata?.pack_id || '') !== transaction.packId
    || Number(metadata?.credits) !== transaction.creditsAdded) {
    return NextResponse.json({ error: 'Payment metadata mismatch.' }, { status: 400 });
  }
  if (!headers['webhook-id'] || !await DbManager.claimPaymentWebhook('dodo', headers['webhook-id'])) {
    return NextResponse.json({ received: true });
  }

  if (payload.type === 'payment.succeeded') {
    await DbManager.completeTransaction(transaction.id, payload.data?.payment_id);
  } else if (payload.type === 'payment.failed' || payload.type === 'payment.cancelled') {
    await DbManager.markTransactionFailed(transaction.id);
  }

  return NextResponse.json({ received: true });
}
