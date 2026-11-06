import { NextRequest, NextResponse } from 'next/server';
import { DbManager } from '@/lib/db';
import { SCENES_PER_MINUTE } from '@/lib/credits';
import { connection } from 'next/server';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'public-payment-packs', limit: 60, windowSeconds: 60, failClosed: false });
    if (limited) return limited;
    await connection();
    const settings = await DbManager.getSettings();
    return NextResponse.json({
      success: true,
      packs: settings.pricingPacks,
      enableTestMode: settings.enableTestMode,
      creditsPerScene: settings.creditsPerScene,
      creditsPerMinute: settings.creditsPerScene * SCENES_PER_MINUTE,
      welcomeCredits: settings.welcomeCredits,
      stripeEnabled: settings.enableStripe,
      stripeAvailable: Boolean(settings.enableStripe && settings.stripePublishableKey && settings.stripeSecretKey),
      razorpayEnabled: settings.enableRazorpay,
      razorpayAvailable: Boolean(settings.enableRazorpay && settings.razorpayKeyId && settings.razorpayKeySecret),
      dodoEnabled: settings.enableDodo,
      dodoAvailable: Boolean(settings.enableDodo && settings.dodoApiKey),
      dodoMode: settings.dodoMode,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load pricing packs.' },
      { status: 500 }
    );
  }
}
