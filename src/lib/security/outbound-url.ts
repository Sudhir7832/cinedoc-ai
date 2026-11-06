import { isIP } from 'node:net';

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
];

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (isIP(host) === 4) return PRIVATE_IPV4.some(pattern => pattern.test(host));
  if (isIP(host) === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
  return false;
}

export function assertAllowedOutboundUrl(
  value: string,
  allowedDomains: readonly string[],
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Outbound URL is invalid.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || isPrivateHost(url.hostname)) {
    throw new Error('Outbound URL is not permitted.');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const allowed = allowedDomains.some(domain => {
    const normalized = domain.toLowerCase().replace(/^\./, '');
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
  if (!allowed) throw new Error('Outbound URL host is not permitted.');
  return url;
}

export async function fetchAllowedOutboundUrl(
  value: string,
  allowedDomains: readonly string[],
  init: RequestInit = {},
): Promise<Response> {
  let url = assertAllowedOutboundUrl(value, allowedDomains);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || redirects === 3) throw new Error('Outbound redirect is not permitted.');
    url = assertAllowedOutboundUrl(new URL(location, url).toString(), allowedDomains);
  }
  throw new Error('Too many outbound redirects.');
}
