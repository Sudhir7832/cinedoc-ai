import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/server';

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowSeconds: number;
  failClosed: boolean;
  discriminator?: string;
}

interface RateLimitRow {
  allowed: boolean;
  remaining: number;
  retry_after: number;
}

interface LocalRateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const localBuckets = new Map<string, LocalRateLimitEntry>();
let warnedAboutFallback = false;

export function consumeLocalRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): { allowed: boolean; retryAfter: number } {
  const windowMs = windowSeconds * 1000;
  const existing = localBuckets.get(key);
  const entry = !existing || now - existing.windowStartedAt >= windowMs
    ? { count: 0, windowStartedAt: now }
    : existing;
  entry.count += 1;
  localBuckets.set(key, entry);
  if (localBuckets.size > 1000) {
    for (const [bucket, value] of localBuckets) {
      if (now - value.windowStartedAt >= windowMs) localBuckets.delete(bucket);
    }
  }
  return {
    allowed: entry.count <= limit,
    retryAfter: Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - now) / 1000)),
  };
}

function localFallbackResponse(bucketKey: string, options: RateLimitOptions): NextResponse | null {
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn('[Security] Distributed rate limiter is unavailable; using the development-only process-local limiter. Apply data/supabase-security-migration.sql.');
  }
  const result = consumeLocalRateLimit(bucketKey, options.limit, options.windowSeconds);
  if (result.allowed) return null;
  const response = NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
  response.headers.set('Retry-After', String(result.retryAfter));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function clientFingerprint(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const address = req.headers.get('x-real-ip') || forwarded || req.headers.get('cf-connecting-ip') || 'unknown';
  return createHash('sha256').update(address).digest('hex');
}

export async function rateLimit(req: NextRequest, options: RateLimitOptions): Promise<NextResponse | null> {
  const rawKey = `${options.bucket}:${clientFingerprint(req)}:${options.discriminator || ''}`;
  const bucketKey = `${options.bucket}:${createHash('sha256').update(rawKey).digest('hex')}`;

  try {
    const client = getServiceSupabase() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{
        data: RateLimitRow[] | RateLimitRow | null;
        error: { message: string } | null;
      }>;
    };
    const { data, error } = await client.rpc('consume_rate_limit', {
      p_key: bucketKey,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });
    if (error) throw new Error('Rate limiter unavailable.');

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') throw new Error('Invalid rate limiter response.');
    if (row.allowed) return null;

    const response = NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
    response.headers.set('Retry-After', String(Math.max(1, Math.ceil(row.retry_after || options.windowSeconds))));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    if (!options.failClosed) return null;
    if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_RATE_LIMIT_FALLBACK === 'true') {
      return localFallbackResponse(bucketKey, options);
    }
    const response = NextResponse.json({ success: false, error: 'Service temporarily unavailable.' }, { status: 503 });
    response.headers.set('Retry-After', '30');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
