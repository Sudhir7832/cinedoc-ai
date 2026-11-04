import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { DbManager } from '@/lib/db';

interface DodoWebhookPayload {
  type?: string;
  data?: {
    payment_id?: string;
    metadata?: Record<string, string | number>;
  };
}

export async function POST(req: NextRequest) {
  const settings = await DbManager.getSettings();
  if (!settings.dodoWebhookKey) return NextResponse.json({ error: 'Dodo webhook key is not configured.' }, { status: 503 });

  const rawBody = await req.text();
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

  const payload = JSON.parse(rawBody) as DodoWebhookPayload;
  const transactionId = String(payload.data?.metadata?.transaction_id || '');
  if (!transactionId) return NextResponse.json({ received: true });
  const transaction = await DbManager.getTransactionById(transactionId);
  if (!transaction || transaction.gateway !== 'dodo') return NextResponse.json({ received: true });

  if (payload.type === 'payment.succeeded') {
    const pack = settings.pricingPacks.find(item => item.id === transaction.packId);
    if (!pack) return NextResponse.json({ error: 'Pricing pack not found.' }, { status: 400 });
    await DbManager.completeTransaction(transaction.id, { providerPaymentId: payload.data?.payment_id, creditsAdded: pack.credits });
  } else if (payload.type === 'payment.failed' || payload.type === 'payment.cancelled') {
    await DbManager.markTransactionFailed(transaction.id);
  }

  return NextResponse.json({ received: true });
}
