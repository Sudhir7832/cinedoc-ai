import type { NextRequest } from 'next/server';
import { RequestSecurityError } from './errors';

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function requestHost(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('host')?.trim() || null;
}

export function getCanonicalOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const configuredOrigin = configured ? normalizeOrigin(configured) : null;
  if (configured && !configuredOrigin) throw new RequestSecurityError(500, 'Server configuration error.');

  if (configuredOrigin) {
    const expectedUrl = new URL(configuredOrigin);
    const expectedHost = expectedUrl.host.toLowerCase();
    const suppliedHost = requestHost(req)?.toLowerCase();
    const suppliedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    if (suppliedHost && suppliedHost !== expectedHost) {
      throw new RequestSecurityError(400, 'Invalid request host.');
    }
    if (suppliedProtocol && `${suppliedProtocol}:` !== expectedUrl.protocol) {
      throw new RequestSecurityError(400, 'Invalid request protocol.');
    }
    return configuredOrigin;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new RequestSecurityError(500, 'Server configuration error.');
  }

  const fallback = normalizeOrigin(req.nextUrl.origin);
  if (!fallback || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(fallback).hostname)) {
    throw new RequestSecurityError(400, 'Invalid request host.');
  }
  return fallback;
}

export function requireSameOrigin(req: NextRequest): void {
  const canonical = getCanonicalOrigin(req);
  const source = req.headers.get('origin') || req.headers.get('referer');
  if (!source || normalizeOrigin(source) !== canonical) {
    throw new RequestSecurityError(403, 'Cross-origin request blocked.');
  }
}

export function isCookieAuthenticatedMutation(req: NextRequest): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    && req.nextUrl.pathname.startsWith('/api/')
    && Boolean(req.headers.get('cookie'));
}
