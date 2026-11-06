import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DbManager } from '@/lib/db';
import { SessionManager } from '@/lib/auth/session';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { paymentVerifySchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

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
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'payment-verify', limit: 20, windowSeconds: 300, failClosed: true });
    if (limited) return limited;
    const user = await SessionManager.requireAuth(req);
    const body = await parseJsonBody(req, paymentVerifySchema, 8 * 1024);
    const settings = await DbManager.getSettings();

    if (body.gateway === 'razorpay') {
      const orderId = body.razorpay_order_id;
      const paymentId = body.razorpay_payment_id;
      const suppliedSignature = body.razorpay_signature;
      const keySecret = (settings.razorpayKeySecret || '').trim();
      const keyId = (settings.razorpayKeyId || '').trim();
      if (!keySecret) throw new Error('Razorpay secret is not configured');

      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
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

      if (transaction.status === 'completed') {
        return NextResponse.json({
          success: true,
          message: `Payment verified. ${transaction.creditsAdded} credits are available.`,
          creditsAdded: transaction.creditsAdded,
        });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const providerResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Basic ${authHeader}` },
      });
      const providerPayment = await providerResponse.json();
      if (!providerResponse.ok
        || providerPayment.order_id !== orderId
        || !['captured', 'authorized'].includes(providerPayment.status)
        || String(providerPayment.currency || '').toUpperCase() !== transaction.currency.toUpperCase()
        || Number(providerPayment.amount) !== Math.round(transaction.amount * 100)) {
        return NextResponse.json({ success: false, error: 'Razorpay payment details do not match this order.' }, { status: 400 });
      }

      const completed = await DbManager.completeTransaction(transaction.id, paymentId);
      return NextResponse.json({
        success: true,
        message: `Payment verified. ${completed.creditsAdded} credits are available.`,
        creditsAdded: completed.creditsAdded,
      });
    }

    if (body.gateway === 'stripe') {
      const sessionId = body.stripe_session_id;
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
        return NextResponse.json({ success: false, error: 'Stripe verification failed.' }, { status: 400 });
      }
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ success: false, error: 'Payment is not completed.' }, { status: 400 });
      }
      if ((session.metadata?.userId || session.client_reference_id) !== transaction.userId) {
        return NextResponse.json({ success: false, error: 'Stripe payment account mismatch.' }, { status: 400 });
      }

      const expectedAmount = Math.round(transaction.amount * 100);
      if (Number(session.amount_total) !== expectedAmount
        || String(session.currency || '').toUpperCase() !== transaction.currency
        || session.metadata?.packId !== transaction.packId
        || Number(session.metadata?.credits) !== transaction.creditsAdded) {
        return NextResponse.json({ success: false, error: 'Stripe payment amount mismatch.' }, { status: 400 });
      }

      const completed = await DbManager.completeTransaction(transaction.id, String(session.payment_intent || sessionId));
      return NextResponse.json({
        success: true,
        message: `Payment verified. ${completed.creditsAdded} credits are available.`,
        creditsAdded: completed.creditsAdded,
      });
    }

    if (body.gateway === 'dodo') {
      const sessionId = body.session_id;
      const paymentId = body.payment_id;
      const txId = body.transaction_id;
      if (!settings.dodoApiKey) throw new Error('Dodo Payments API key is not configured');

      const transactions = await DbManager.getTransactions();
      const transaction = transactions.find(tx => 
        tx.gateway === 'dodo' && (
          (txId && tx.id === txId) ||
          (sessionId && tx.paymentId === sessionId) ||
          (paymentId && tx.providerPaymentId === paymentId)
        )
      );

      if (!transaction) {
        return NextResponse.json({ success: false, error: 'Dodo transaction not found.' }, { status: 404 });
      }

      if (transaction.userId !== user.id && user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Payment does not belong to this account.' }, { status: 403 });
      }

      if (transaction.status === 'completed') {
        return NextResponse.json({
          success: true,
          message: `Payment verified. ${transaction.creditsAdded} credits are available.`,
          creditsAdded: transaction.creditsAdded,
        });
      }

      const dodoBase = settings.dodoMode === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
      let verifiedPaymentId = paymentId || transaction.providerPaymentId;
      let paymentConfirmed = false;

      // 1. Check via Dodo Checkout Session endpoint
      const checkSessionId = sessionId || transaction.paymentId;
      if (checkSessionId && checkSessionId.startsWith('cks_')) {
        try {
          const sessionRes = await fetch(`${dodoBase}/checkouts/${encodeURIComponent(checkSessionId)}`, {
            headers: { Authorization: `Bearer ${settings.dodoApiKey}` },
          });
          if (sessionRes.ok) {
            const sData = await sessionRes.json();
            if (sData.payment_status === 'succeeded' || sData.status === 'succeeded') {
              paymentConfirmed = true;
              verifiedPaymentId = sData.payment_id || verifiedPaymentId;
            }
          }
        } catch (sessionErr) {
          console.warn('[Dodo Verify] Session lookup failed:', sessionErr);
        }
      }

      // 2. Fallback check via Dodo Payment endpoint
      if (!paymentConfirmed && verifiedPaymentId) {
        try {
          const payRes = await fetch(`${dodoBase}/payments/${encodeURIComponent(verifiedPaymentId)}`, {
            headers: { Authorization: `Bearer ${settings.dodoApiKey}` },
          });
          if (payRes.ok) {
            const pData = await payRes.json();
            if (pData.status === 'succeeded' || pData.status === 'paid' || pData.status === 'completed') {
              paymentConfirmed = true;
            }
          }
        } catch (payErr) {
          console.warn('[Dodo Verify] Payment lookup failed:', payErr);
        }
      }

      if (!paymentConfirmed) {
        return NextResponse.json({ success: false, error: 'Dodo payment has not been completed yet.' }, { status: 400 });
      }

      const completed = await DbManager.completeTransaction(transaction.id, verifiedPaymentId || undefined);
      return NextResponse.json({
        success: true,
        message: `Payment verified. ${completed.creditsAdded} credits are available.`,
        creditsAdded: completed.creditsAdded,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid payment gateway.' }, { status: 400 });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Payment verification failed.');
  }
}
