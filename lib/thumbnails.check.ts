// Checks for lib/thumbnails.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { thumbUrl } from './thumbnails';

const base = 'https://x.supabase.co/storage/v1/object/public/drinks/';
// The same mapping as supabase/functions/_shared/thumbnail.ts thumbPath.
assert.equal(thumbUrl(`${base}cocktails/abc/1791417617256.jpg`), `${base}thumbs/cocktails/abc/1791417617256.jpg`);
assert.equal(thumbUrl(`${base}catalog/f39d/hero-e174.png`), `${base}thumbs/catalog/f39d/hero-e174.jpg`, 'always a JPEG');
assert.equal(thumbUrl(`${base}menus/m1/123.webp?v=2`), `${base}thumbs/menus/m1/123.jpg?v=2`);
assert.equal(thumbUrl(`${base}thumbs/cocktails/abc/1.jpg`), null, 'a thumbnail has no thumbnail');
assert.equal(thumbUrl('https://example.com/photo.jpg'), null, 'another host');
assert.equal(thumbUrl('file:///var/mobile/photo.jpg'), null, 'a local file');
assert.equal(thumbUrl('https://x.supabase.co/storage/v1/object/public/avatars/u/1.jpg'), null, 'another bucket');

console.log('thumbnails: ok');
