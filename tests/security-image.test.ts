import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage, validateImage } from '../src/lib/security/image';

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('image inspection reads dimensions and rejects oversized or fake images', () => {
  assert.deepEqual(inspectImage(pngHeader(1920, 1080)), { format: 'png', width: 1920, height: 1080 });
  assert.equal(validateImage(pngHeader(1920, 1080), { maxWidth: 8192, maxHeight: 8192, maxPixels: 40_000_000 }).format, 'png');
  assert.throws(() => validateImage(pngHeader(100_000, 100_000), { maxWidth: 8192, maxHeight: 8192, maxPixels: 40_000_000 }), /dimensions/);
  assert.throws(() => validateImage(Buffer.from('not an image'), { maxWidth: 8192, maxHeight: 8192, maxPixels: 40_000_000 }), /valid supported image/);
});
