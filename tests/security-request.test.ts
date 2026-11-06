import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJsonBody, requireBoundedContentLength } from '../src/lib/security/request';

test('JSON parsing rejects oversized, wrong-content-type, and unknown fields', async () => {
  const schema = z.strictObject({ value: z.string().max(10) });
  await assert.rejects(
    parseJsonBody(new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(20) }),
    }), schema, 128),
    /Invalid request body/,
  );
  await assert.rejects(
    parseJsonBody(new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{"value":"ok"}',
    }), schema, 128),
    /Content-Type/,
  );
  await assert.rejects(
    parseJsonBody(new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'ok', status: 'completed' }),
    }), schema, 128),
    /Invalid request body/,
  );
});

test('multipart requests require a bounded declared length', () => {
  assert.throws(() => requireBoundedContentLength(new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: new Uint8Array([1, 2, 3]),
    // Remove the automatically generated content length to model chunked input.
    headers: { 'transfer-encoding': 'chunked' },
  }), 1024), /Content-Length/);
});
