import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    const body = await req.json();
    const { packId, gateway = 'test', currency = 'USD' } = body;

    if (!['test', 'stripe', 'razorpay', 'dodo'].includes(gateway)) {
      return NextResponse.json({ success: false, error: 'Invalid payment gateway.' }, { status: 400 });
    }
    if (!['USD', 'INR'].includes(currency)) {
      return NextResponse.json({ success: false, error: 'Currency must be USD or INR.' }, { status: 400 });
    }

    const settings = await DbManager.getSettings();
    const pack = settings.pricingPacks.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json({ success: false, error: 'Invalid pricing pack selected' }, { status: 400 });
    }

    const amount = currency === 'INR' ? pack.priceInr : pack.priceUsd;

    // 1. Sandbox / 1-Click Test Checkout Mode
    if (gateway === 'test') {
      if (!settings.enableTestMode || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Sandbox checkout is restricted to administrators.' }, { status: 403 });
      }
      const paymentId = `test_pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const tx = await DbManager.recordTransaction({
        userId: user.id,
        userEmail: user.email,
        packId: pack.id,
        packName: pack.name,
        amount,
        currency,
        creditsAdded: pack.credits,
        gateway: 'test',
        status: 'completed',
        paymentId,
      });

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
      const origin = req.nextUrl.origin || 'http://localhost:3000';
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
        creditsAdded: 0, // Assigned on webhook / verify
        gateway: 'stripe',
        status: 'pending',
        paymentId: session.id,
      });

      return NextResponse.json({
        success: true,
        mode: 'stripe',
        checkoutUrl: session.url,
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
        currency, creditsAdded: 0, gateway: 'dodo', status: 'pending', paymentId: `dodo_pending_${Date.now()}`,
      });
      const endpoint = settings.dodoMode === 'live' ? 'https://live.dodopayments.com/checkouts' : 'https://test.dodopayments.com/checkouts';
      const dodoResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.dodoApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_cart: [{ product_id: pack.dodoProductId, quantity: 1 }],
          customer: { email: user.email, name: user.name },
          billing_currency: currency,
          allowed_payment_method_types: ['credit', 'debit', 'apple_pay', 'google_pay'],
          return_url: `${req.nextUrl.origin}/?payment=success&gateway=dodo`,
          cancel_url: `${req.nextUrl.origin}/?payment=cancelled&gateway=dodo`,
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
      return NextResponse.json({ success: true, mode: 'dodo', checkoutUrl: dodo.checkout_url, sessionId: dodo.session_id });
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
        creditsAdded: 0,
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
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
