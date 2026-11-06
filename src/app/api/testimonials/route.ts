import { NextRequest, NextResponse } from 'next/server';
import { TestimonialManager } from '@/lib/testimonials';
import { connection } from 'next/server';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { bucket: 'public-testimonials', limit: 60, windowSeconds: 60, failClosed: false });
  if (limited) return limited;
  await connection();
  return NextResponse.json({ success: true, testimonials: await TestimonialManager.list(false) });
}
