import assert from 'node:assert/strict';

import { decodableSize, imageSize } from '../supabase/functions/_shared/imageSize';
import { DEFAULT_SITE, siteOrigin } from '../supabase/functions/_shared/site';

// Input limits the edge functions apply before trusting what a caller sent.

// --- image headers (venue-app, upload-bar-logo) ---

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment (length 16), then SOF0 with the size.
  const app0 = [0xff, 0xe0, 0, 16, ...new Array(14).fill(0)];
  const sof0 = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, ...new Array(9).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0]);
}

function gif(width: number, height: number): Uint8Array {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, width & 0xff, width >> 8, height & 0xff, height >> 8, 0, 0, 0]);
}

assert.deepEqual(imageSize(png(512, 256)), { format: 'png', width: 512, height: 256 });
assert.deepEqual(imageSize(jpeg(1200, 800)), { format: 'jpeg', width: 1200, height: 800 });
assert.deepEqual(imageSize(gif(64, 32)), { format: 'gif', width: 64, height: 32 });
assert.equal(imageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
assert.equal(imageSize(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])), null, 'broken JPEG segments');

assert.equal(decodableSize(png(4096, 4096)), true);
assert.equal(decodableSize(png(20000, 20000)), false, 'a decompression bomb');
assert.equal(decodableSize(png(8192, 2049)), false, 'over the pixel budget');
assert.equal(decodableSize(png(9000, 10)), false, 'over the side limit');
assert.equal(decodableSize(png(0, 10)), false);
assert.equal(decodableSize(jpeg(65535, 65535)), false);
assert.equal(decodableSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), false, 'unknown formats');

// --- invite email links (send-bar-invite) ---

assert.equal(siteOrigin('https://babyvom.it', DEFAULT_SITE, false), 'https://babyvom.it');
assert.equal(siteOrigin('https://babyvom.it/some/page', DEFAULT_SITE, false), 'https://babyvom.it');
assert.equal(siteOrigin('https://example.com', DEFAULT_SITE, false), 'https://babyvom.it', 'another site');
assert.equal(siteOrigin('https://babyvom.it.example.com', DEFAULT_SITE, false), 'https://babyvom.it');
assert.equal(siteOrigin('javascript:alert(1)', DEFAULT_SITE, false), 'https://babyvom.it');
assert.equal(siteOrigin(undefined, DEFAULT_SITE, false), 'https://babyvom.it');
assert.equal(siteOrigin('http://localhost:8081', DEFAULT_SITE, false), 'https://babyvom.it', 'localhost in production');
assert.equal(siteOrigin('http://localhost:8081', DEFAULT_SITE, true), 'http://localhost:8081', 'localhost on a local stack');
assert.equal(siteOrigin('https://staging.example.org/x', 'https://staging.example.org', false), 'https://staging.example.org', 'SITE_URL');

console.log('edge input checks passed');
