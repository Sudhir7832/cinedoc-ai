import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DbManager } from '@/lib/db';
import { SessionManager } from '@/lib/auth/session';

function signaturesMatch(expectedHex: string, suppliedHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const supplied = Buffer.from(suppliedHex, 'hex');
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    const body = await req.json();
    const settings = await DbManager.getSettings();

    if (body.gateway === 'razorpay') {
      const orderId = String(body.razorpay_order_id || '');
      const paymentId = String(body.razorpay_payment_id || '');
      const suppliedSignature = String(body.razorpay_signature || '');
      if (!orderId || !paymentId || !suppliedSignature) {
        return NextResponse.json({ success: false, error: 'Incomplete Razorpay verification payload.' }, { status: 400 });
      }
      if (!settings.razorpayKeySecret) throw new Error('Razorpay secret is not configured');

      const expectedSignature = crypto
        .createHmac('sha256', settings.razorpayKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      if (!signaturesMatch(expectedSignature, suppliedSignature)) {
        return NextResponse.json({ success: false, error: 'Invalid Razorpay signature.' }, { status: 400 });
      }

      const transaction = (await DbManager.getTransactions()).find(tx => tx.gateway === 'razorpay' && tx.paymentId === orderId);
      if (!transaction) return NextResponse.json({ success: false, error: 'Payment order was not found.' }, { status: 404 });
      if (transaction.userId !== user.id && user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Payment does not belong to this account.' }, { status: 403 });
      }

      const pack = settings.pricingPacks.find(item => item.id === transaction.packId);
      if (!pack) return NextResponse.json({ success: false, error: 'The purchased plan is no longer available.' }, { status: 400 });

      const completed = await DbManager.completeTransaction(transaction.id, {
        providerPaymentId: paymentId,
        creditsAdded: pack.credits,
      });
      return NextResponse.json({
        success: true,
        message: `Payment verified. ${completed.creditsAdded} credits are available.`,
        creditsAdded: completed.creditsAdded,
      });
    }

    if (body.gateway === 'stripe') {
      const sessionId = String(body.stripe_session_id || '');
      if (!sessionId) return NextResponse.json({ success: false, error: 'Stripe session ID is required.' }, { status: 400 });
      if (!settings.stripeSecretKey) throw new Error('Stripe secret key is not configured');

      const transaction = (await DbManager.getTransactions()).find(tx => tx.gateway === 'stripe' && tx.paymentId === sessionId);
      if (!transaction) return NextResponse.json({ success: false, error: 'Stripe checkout session was not found.' }, { status: 404 });
      if (transaction.userId !== user.id && user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Payment does not belong to this account.' }, { status: 403 });
      }

      const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${settings.stripeSecretKey}` },
      });
      const session = await stripeResponse.json();
      if (!stripeResponse.ok) {
        return NextResponse.json({ success: false, error: session.error?.message || 'Stripe verification failed.' }, { status: 400 });
      }
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ success: false, error: 'Payment is not completed.' }, { status: 400 });
      }
      if ((session.metadata?.userId || session.client_reference_id) !== transaction.userId) {
        return NextResponse.json({ success: false, error: 'Stripe payment account mismatch.' }, { status: 400 });
      }

      const pack = settings.pricingPacks.find(item => item.id === transaction.packId);
      if (!pack) return NextResponse.json({ success: false, error: 'The purchased plan is no longer available.' }, { status: 400 });
      const expectedAmount = Math.round(transaction.amount * 100);
      if (Number(session.amount_total) !== expectedAmount) {
        return NextResponse.json({ success: false, error: 'Stripe payment amount mismatch.' }, { status: 400 });
      }

      const completed = await DbManager.completeTransaction(transaction.id, {
        providerPaymentId: String(session.payment_intent || sessionId),
        creditsAdded: pack.credits,
      });
      return NextResponse.json({
        success: true,
        message: `Payment verified. ${completed.creditsAdded} credits are available.`,
        creditsAdded: completed.creditsAdded,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid payment gateway.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment verification failed';
    const status = message.includes('Authentication required') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
