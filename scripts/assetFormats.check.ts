import assert from 'node:assert/strict';
import { globSync, openSync, readSync, closeSync } from 'node:fs';

// Android's resource compiler (AAPT2) rejects an image whose contents don't
// match its extension, e.g. a JPEG named .png, and fails the store build.
// iOS and web don't mind, so nothing else catches it.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

function header(file: string): Buffer {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(12);
  readSync(fd, buf, 0, 12, 0);
  closeSync(fd);
  return buf;
}

const files = globSync('assets/**/*.{png,jpg,jpeg,webp}');
assert.ok(files.length > 0, 'expected images under assets/');
const mislabeled = files.filter((file) => {
  const ext = file.split('.').pop()!.toLowerCase();
  return !SIGNATURES[ext](header(file));
});
assert.deepEqual(mislabeled, [], `images whose contents don't match their extension: ${mislabeled.join(', ')}`);

console.log(`assetFormats.check: ok (${files.length} images)`);
