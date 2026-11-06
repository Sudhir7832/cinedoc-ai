import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { RequestSecurityError } from './errors';

function declaredLength(req: NextRequest): number | null {
  const value = req.headers.get('content-length');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function enforceContentLength(req: NextRequest, maxBytes: number): void {
  const length = declaredLength(req);
  if (length !== null && length > maxBytes) {
    throw new RequestSecurityError(413, 'Request body is too large.');
  }
}

export function requireBoundedContentLength(req: NextRequest, maxBytes: number): void {
  const length = declaredLength(req);
  if (length === null) throw new RequestSecurityError(411, 'Content-Length is required.');
  if (length > maxBytes) throw new RequestSecurityError(413, 'Request body is too large.');
}

export async function readBodyText(req: NextRequest, maxBytes: number): Promise<string> {
  enforceContentLength(req, maxBytes);
  if (!req.body) return '';

  const reader = req.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestSecurityError(413, 'Request body is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError(400, 'Invalid request body.');
  }
  return text;
}

export async function parseJsonBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T,
  maxBytes = 16 * 1024,
): Promise<z.infer<T>> {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw new RequestSecurityError(415, 'Content-Type must be application/json.');
  }

  const raw = await readBodyText(req, maxBytes);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new RequestSecurityError(400, 'Invalid request body.');
  }

  const result = schema.safeParse(value);
  if (!result.success) throw new RequestSecurityError(400, 'Invalid request body.');
  return result.data;
}
