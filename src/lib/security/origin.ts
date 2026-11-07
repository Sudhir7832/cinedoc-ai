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
  const configuredRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const suppliedHost = requestHost(req)?.toLowerCase();
  const suppliedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() || (req.url.startsWith('https') ? 'https' : 'http');

  if (configuredRaw) {
    const configuredList = configuredRaw.split(',').map(s => s.trim()).filter(Boolean);
    const normalizedList = configuredList.map(normalizeOrigin).filter((o): o is string => Boolean(o));

    // If any configured origin matches the incoming request host
    if (suppliedHost) {
      const match = normalizedList.find(o => {
        const u = new URL(o);
        return u.host.toLowerCase() === suppliedHost;
      });
      if (match) {
        return match;
      }
    }

    if (normalizedList.length > 0) {
      const primary = normalizedList[0];
      const primaryUrl = new URL(primary);
      const primaryHost = primaryUrl.host.toLowerCase();
      const isPrimaryLocal = primaryHost.includes('localhost') || primaryHost.includes('127.0.0.1');

      // If NEXT_PUBLIC_SITE_URL was left as localhost/127.0.0.1, but the app is deployed to a server:
      if (isPrimaryLocal && suppliedHost && !suppliedHost.includes('localhost') && !suppliedHost.includes('127.0.0.1')) {
        return `${suppliedProto}://${suppliedHost}`;
      }

      // Check protocol & host matching for strict production
      if (suppliedHost && suppliedHost !== primaryHost) {
        throw new RequestSecurityError(400, 'Invalid request host.');
      }
      return primary;
    }
  }

  // Fallback when NEXT_PUBLIC_SITE_URL is not set or dynamic
  if (suppliedHost) {
    return `${suppliedProto}://${suppliedHost}`;
  }

  const fallback = normalizeOrigin(req.nextUrl.origin);
  if (!fallback) {
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
