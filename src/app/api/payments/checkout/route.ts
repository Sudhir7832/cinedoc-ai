import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import crypto from 'crypto';
import { getCanonicalOrigin, requireSameOrigin } from '@/lib/security/origin';
import { assertAllowedOutboundUrl } from '@/lib/security/outbound-url';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { checkoutSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'payment-checkout', limit: 10, windowSeconds: 300, failClosed: true });
    if (limited) return limited;
    const user = await SessionManager.requireAuth(req);
    const { packId, gateway, currency } = await parseJsonBody(req, checkoutSchema, 4 * 1024);
    if (gateway === 'razorpay' && currency !== 'INR') {
      return NextResponse.json({ success: false, error: 'Razorpay checkout is available in INR.' }, { status: 400 });
    }
    if (gateway === 'stripe' && currency !== 'USD') {
      return NextResponse.json({ success: false, error: 'Stripe checkout is available in USD.' }, { status: 400 });
    }

    const settings = await DbManager.getSettings();
    const pack = settings.pricingPacks.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json({ success: false, error: 'Invalid pricing pack selected' }, { status: 400 });
    }

    const amount = (gateway === 'dodo' || currency === 'USD') ? pack.priceUsd : pack.priceInr;
    const checkoutCurrency = gateway === 'dodo' ? 'USD' : currency;

    // 1. Sandbox / 1-Click Test Checkout Mode
    if (gateway === 'test') {
      if (!settings.enableTestMode || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Sandbox checkout is restricted to administrators.' }, { status: 403 });
      }
      const paymentId = `test_pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const pending = await DbManager.recordTransaction({
        userId: user.id,
        userEmail: user.email,
        packId: pack.id,
        packName: pack.name,
        amount,
        currency,
        creditsAdded: pack.credits,
        gateway: 'test',
        status: 'pending',
        paymentId,
      });
      const tx = await DbManager.completeTransaction(pending.id, paymentId);

      const updatedUser = await DbManager.getUserById(user.id);

      return NextResponse.json({
        success: true,
        mode: 'test',
        message: `Successfully added ${pack.credits} credits to your account!`,
        transaction: tx,
        user: updatedUser ? DbManager.toSafeUser(updatedUser) : null,
      });
    }

    // 2. Stripe Checkout Integration
    if (gateway === 'stripe') {
      if (!settings.enableStripe) {
        return NextResponse.json({ success: false, error: 'Stripe payments are currently paused.' }, { status: 503 });
      }
      if (!settings.stripeSecretKey) {
        return NextResponse.json(
          { success: false, error: 'Stripe is not configured yet. Please configure Stripe Secret Key in Admin Settings or use Sandbox Test Mode.' },
          { status: 400 }
        );
      }

      // Create Stripe Checkout Session using Stripe REST API
      const origin = getCanonicalOrigin(req);
      const unitAmountInCents = Math.round(amount * 100);

      const params = new URLSearchParams();
      params.append('payment_method_types[]', 'card');
      params.append('line_items[0][price_data][currency]', currency.toLowerCase());
      params.append('line_items[0][price_data][product_data][name]', `${pack.name} (${pack.credits} Credits)`);
      params.append('line_items[0][price_data][product_data][description]', `${pack.description} Includes ${pack.credits} production credits.`);
      params.append('line_items[0][price_data][unit_amount]', unitAmountInCents.toString());
      params.append('line_items[0][quantity]', '1');
      params.append('mode', 'payment');
      params.append('success_url', `${origin}/?payment=success&pack=${pack.id}&session_id={CHECKOUT_SESSION_ID}`);
      params.append('cancel_url', `${origin}/?payment=cancelled`);
      params.append('client_reference_id', user.id);
      params.append('metadata[userId]', user.id);
      params.append('metadata[userEmail]', user.email);
      params.append('metadata[packId]', pack.id);
      params.append('metadata[credits]', pack.credits.toString());

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        throw new Error(session.error?.message || 'Failed to initialize Stripe checkout session');
      }

      // Record pending transaction
      await DbManager.recordTransaction({
        userId: user.id,
        userEmail: user.email,
        packId: pack.id,
        packName: pack.name,
        amount,
        currency,
        creditsAdded: pack.credits,
        gateway: 'stripe',
        status: 'pending',
        paymentId: session.id,
      });

      const checkoutUrl = assertAllowedOutboundUrl(String(session.url || ''), ['stripe.com']).toString();
      return NextResponse.json({
        success: true,
        mode: 'stripe',
        checkoutUrl,
        sessionId: session.id,
      });
    }

    // 3. Dodo Payments hosted checkout
    if (gateway === 'dodo') {
      if (!settings.enableDodo) return NextResponse.json({ success: false, error: 'Dodo Payments is currently paused.' }, { status: 503 });
      if (!settings.dodoApiKey) return NextResponse.json({ success: false, error: 'Dodo Payments API key is not configured.' }, { status: 400 });
      if (!pack.dodoProductId) return NextResponse.json({ success: false, error: `Dodo product ID is missing for ${pack.name}.` }, { status: 400 });

      const pending = await DbManager.recordTransaction({
        userId: user.id, userEmail: user.email, packId: pack.id, packName: pack.name, amount,
        currency: checkoutCurrency, creditsAdded: pack.credits, gateway: 'dodo', status: 'pending', paymentId: `dodo_pending_${Date.now()}`,
      });
      const isTestKey = settings.dodoApiKey.startsWith('dodo_test_');
      const endpoint = isTestKey || settings.dodoMode === 'test'
        ? 'https://test.dodopayments.com/checkouts'
        : 'https://live.dodopayments.com/checkouts';
      const dodoResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.dodoApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_cart: [{ product_id: pack.dodoProductId, quantity: 1 }],
          customer: { email: user.email, name: user.name },
          billing_currency: checkoutCurrency,
          allowed_payment_method_types: ['credit', 'debit', 'apple_pay', 'google_pay'],
          return_url: `${getCanonicalOrigin(req)}/?payment=success&gateway=dodo&tx_id=${pending.id}`,
          cancel_url: `${getCanonicalOrigin(req)}/?payment=cancelled&gateway=dodo`,
          metadata: { transaction_id: pending.id, user_id: user.id, pack_id: pack.id, credits: pack.credits },
          feature_flags: { redirect_immediately: true },
        }),
      });
      const dodo = await dodoResponse.json();
      if (!dodoResponse.ok || !dodo.checkout_url) {
        await DbManager.markTransactionFailed(pending.id);
        throw new Error(dodo.message || dodo.error?.message || 'Dodo checkout initialization failed.');
      }
      await DbManager.updateTransactionReference(pending.id, dodo.session_id, dodo.payment_id || undefined);
      const checkoutUrl = assertAllowedOutboundUrl(String(dodo.checkout_url), ['dodopayments.com']).toString();
      return NextResponse.json({ success: true, mode: 'dodo', checkoutUrl, sessionId: dodo.session_id });
    }

    // 4. Razorpay Orders Integration
    if (gateway === 'razorpay') {
      if (!settings.enableRazorpay) {
        return NextResponse.json({ success: false, error: 'Razorpay payments are currently paused.' }, { status: 503 });
      }
      if (!settings.razorpayKeyId || !settings.razorpayKeySecret) {
        return NextResponse.json(
          { success: false, error: 'Razorpay is not configured yet. Please configure Razorpay Keys in Admin Settings or use Sandbox Test Mode.' },
          { status: 400 }
        );
      }

      const receipt = `rcpt_${Date.now()}`;
      const amountInPaise = Math.round(pack.priceInr * 100);

      const authHeader = Buffer.from(`${settings.razorpayKeyId}:${settings.razorpayKeySecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
          notes: {
            userId: user.id,
            userEmail: user.email,
            packId: pack.id,
            credits: pack.credits,
          },
        }),
      });

      const order = await rzpRes.json();
      if (!rzpRes.ok) {
        throw new Error(order.error?.description || 'Failed to initialize Razorpay order');
      }

      await DbManager.recordTransaction({
        userId: user.id,
        userEmail: user.email,
        packId: pack.id,
        packName: pack.name,
        amount: pack.priceInr,
        currency: 'INR',
        creditsAdded: pack.credits,
        gateway: 'razorpay',
        status: 'pending',
        paymentId: order.id,
      });

      return NextResponse.json({
        success: true,
        mode: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: 'INR',
        keyId: settings.razorpayKeyId,
        packName: pack.name,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown payment gateway specified' }, { status: 400 });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Checkout failed.');
  }
}
