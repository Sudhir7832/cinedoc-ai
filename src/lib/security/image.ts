import { RequestSecurityError } from './errors';

export interface ImageMetadata {
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
}

function readUint24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function jpegDimensions(buffer: Buffer): ImageMetadata | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2 || offset + size + 2 > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { format: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += size + 2;
  }
  return null;
}

export function inspectImage(buffer: Buffer): ImageMetadata | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  const jpeg = jpegDimensions(buffer);
  if (jpeg) return jpeg;
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const kind = buffer.subarray(12, 16).toString('ascii');
    if (kind === 'VP8X') return { format: 'webp', width: readUint24LE(buffer, 24) + 1, height: readUint24LE(buffer, 27) + 1 };
    if (kind === 'VP8 ' && buffer.length >= 30) return { format: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export function validateImage(buffer: Buffer, options: { maxWidth: number; maxHeight: number; maxPixels: number }): ImageMetadata {
  const metadata = inspectImage(buffer);
  if (!metadata || metadata.width < 1 || metadata.height < 1) {
    throw new RequestSecurityError(400, 'The uploaded file is not a valid supported image.');
  }
  if (metadata.width > options.maxWidth || metadata.height > options.maxHeight || metadata.width * metadata.height > options.maxPixels) {
    throw new RequestSecurityError(400, 'Image dimensions are too large.');
  }
  return metadata;
}
