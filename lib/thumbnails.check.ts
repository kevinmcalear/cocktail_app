// Checks for lib/thumbnails.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { copyToTry, markNoCopy, markNoThumb, pageCopyUrl, thumbToTry, thumbUrl } from './thumbnails';

const base = 'https://x.supabase.co/storage/v1/object/public/drinks/';
// The same mapping as supabase/functions/_shared/thumbnail.ts thumbPath.
assert.equal(thumbUrl(`${base}cocktails/abc/1791417617256.jpg`), `${base}thumbs/cocktails/abc/1791417617256.jpg`);
assert.equal(thumbUrl(`${base}catalog/f39d/hero-e174.png`), `${base}thumbs/catalog/f39d/hero-e174.jpg`, 'always a JPEG');
assert.equal(thumbUrl(`${base}menus/m1/123.webp?v=2`), `${base}thumbs/menus/m1/123.jpg?v=2`);
assert.equal(thumbUrl(`${base}thumbs/cocktails/abc/1.jpg`), null, 'a thumbnail has no thumbnail');
assert.equal(thumbUrl('https://example.com/photo.jpg'), null, 'another host');
assert.equal(thumbUrl('file:///var/mobile/photo.jpg'), null, 'a local file');
assert.equal(thumbUrl('https://x.supabase.co/storage/v1/object/public/avatars/u/1.jpg'), null, 'another bucket');

// A copy that failed once isn't asked for again; others still are.
const photo = `${base}cocktails/abc/9.jpg`;
assert.equal(thumbToTry(photo), `${base}thumbs/cocktails/abc/9.jpg`);
markNoThumb(photo);
assert.equal(thumbToTry(photo), null, 'straight to the original');
assert.equal(thumbToTry(`${base}cocktails/abc/10.jpg`), `${base}thumbs/cocktails/abc/10.jpg`);
assert.equal(thumbToTry('https://example.com/photo.jpg'), null);

// The page copy: beside the original, its own type (a cut-out stays a PNG).
assert.equal(pageCopyUrl(`${base}cocktails/abc/1.jpg`), `${base}cocktails/abc/1@1080.jpg`);
assert.equal(pageCopyUrl(`${base}cocktails/abc/cut.png?v=3`), `${base}cocktails/abc/cut@1080.png?v=3`);
assert.equal(pageCopyUrl(`${base}cocktails/abc/1@1080.jpg`), null, 'a copy has no copy');
assert.equal(thumbUrl(`${base}cocktails/abc/1@1080.jpg`), null);
assert.equal(pageCopyUrl('https://example.com/photo.jpg'), null);

// Asked for only when the row says the copies were made (images.thumbhash), and not again after a 404.
const page = `${base}cocktails/abc/11.jpg`;
assert.equal(copyToTry(page, 'page', false), null, 'an older photo: the original, no 404 first');
assert.equal(copyToTry(page, 'page', true), `${base}cocktails/abc/11@1080.jpg`);
markNoCopy(page, 'page');
assert.equal(copyToTry(page, 'page', true), null);
assert.equal(copyToTry(page, 'thumb'), `${base}thumbs/cocktails/abc/11.jpg`, 'a failed page copy says nothing about the list copy');

console.log('thumbnails: ok');
