import assert from 'node:assert/strict';
import { heroPicture, orderedPictures, pictureTag } from './itemImages';

const sketch = { sort_order: 0, is_generated: true, images: { url: 'sketch.png' } };
const photoB = { sort_order: 2, is_generated: false, images: { url: 'b.jpg' } };
const photoA = { sort_order: 1, is_generated: false, outdated_since: '2026-09-25T00:00:00Z', images: { url: 'a.jpg' } };
const broken = { sort_order: 0, is_generated: false, images: null };

// Photos come before sketches whatever their saved order; links without a file are dropped.
assert.deepEqual(
  orderedPictures([sketch, photoB, broken, photoA]).map((p) => p.url),
  ['a.jpg', 'b.jpg', 'sketch.png']
);
assert.equal(heroPicture([sketch, photoB])?.url, 'b.jpg');
assert.equal(heroPicture([sketch])?.isSketch, true);
assert.equal(heroPicture([]), null);
assert.equal(heroPicture(undefined), null);

// Rows from before the migration (no flags selected) count as photos.
assert.equal(heroPicture([{ images: { url: 'old.jpg' } }])?.isSketch, false);

assert.equal(pictureTag(heroPicture([sketch])), 'Sketch');
assert.equal(pictureTag(heroPicture([photoA])), 'May be out of date');
assert.equal(pictureTag(heroPicture([photoB])), null);
assert.equal(pictureTag(null), null);
// A sketch is never "out of date" to the viewer: the server redraws it.
assert.equal(pictureTag(orderedPictures([{ ...sketch, outdated_since: 'x' }])[0]), 'Sketch');

console.log('itemImages.check: ok');
