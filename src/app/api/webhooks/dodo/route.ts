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
      type: typeof incoming.type === 'string' ? incoming.type : undefined,
      data: incomingData ? {
        payment_id: typeof incomingData.payment_id === 'string' ? incomingData.payment_id : undefined,
        checkout_session_id: typeof incomingData.checkout_session_id === 'string' ? incomingData.checkout_session_id : undefined,
        status: typeof incomingData.status === 'string' ? incomingData.status : undefined,
        metadata: incomingData.metadata && typeof incomingData.metadata === 'object' && !Array.isArray(incomingData.metadata)
          ? incomingData.metadata as Record<string, string | number>
          : undefined,
      } : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  const transactionId = String(payload.data?.metadata?.transaction_id || '');
  const checkoutSessionId = String(payload.data?.checkout_session_id || '');
  const paymentId = String(payload.data?.payment_id || '');

  let transaction = transactionId ? await DbManager.getTransactionById(transactionId) : null;
  if (!transaction && (checkoutSessionId || paymentId)) {
    const all = await DbManager.getTransactions();
    transaction = all.find(tx =>
      tx.gateway === 'dodo' && (
        (checkoutSessionId && tx.paymentId === checkoutSessionId) ||
        (paymentId && tx.providerPaymentId === paymentId)
      )
    ) || null;
  }

  if (!transaction || transaction.gateway !== 'dodo') return NextResponse.json({ received: true });
  if (transaction.status === 'completed') return NextResponse.json({ received: true });

  const metadata = payload.data?.metadata;
  if (metadata) {
    if (metadata.user_id && String(metadata.user_id) !== transaction.userId) {
      return NextResponse.json({ error: 'Payment user mismatch.' }, { status: 400 });
    }
    if (metadata.pack_id && String(metadata.pack_id) !== transaction.packId) {
      return NextResponse.json({ error: 'Payment pack mismatch.' }, { status: 400 });
    }
  }

  if (headers['webhook-id']) {
    try {
      const claimed = await DbManager.claimPaymentWebhook('dodo', headers['webhook-id']);
      if (!claimed) return NextResponse.json({ received: true });
    } catch {
      // Non-fatal if idempotency table is not configured
    }
  }

  const status = String(payload.data?.status || '').toLowerCase();
  const eventType = String(payload.type || '').toLowerCase();

  if (eventType === 'payment.succeeded' || status === 'succeeded' || status === 'paid' || status === 'completed') {
    await DbManager.completeTransaction(transaction.id, paymentId || undefined);
  } else if (eventType === 'payment.failed' || eventType === 'payment.cancelled' || status === 'failed') {
    await DbManager.markTransactionFailed(transaction.id);
  }

  return NextResponse.json({ received: true });
}
