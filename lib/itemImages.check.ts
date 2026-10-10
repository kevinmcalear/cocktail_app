import assert from 'node:assert/strict';
import { batchedDrinkKey, heroPicture, orderedPictures, pictureLabel, pictureTag, withDrinkPhotos } from './itemImages';

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

// Drawings carry no visible tag; only an out-of-date photo does.
assert.equal(pictureTag(heroPicture([sketch])), null);
assert.equal(pictureTag(heroPicture([photoA])), 'May be out of date');
assert.equal(pictureTag(heroPicture([photoB])), null);
assert.equal(pictureTag(null), null);
// A sketch is never "out of date" to the viewer: the server redraws it.
assert.equal(pictureTag(orderedPictures([{ ...sketch, outdated_since: 'x' }])[0]), null);

// Labels say the position and the tag in words, never by colour alone.
const pictures = orderedPictures([sketch, photoB, photoA]);
assert.deepEqual(
  pictures.map((p, i) => pictureLabel(p, i, pictures.length)),
  ['Photo 1 of 3, may be out of date', 'Photo 2 of 3', 'Photo 3 of 3, sketch']
);
assert.equal(pictureLabel(pictures[1], 0, 1), 'Photo');
// Service angles never become the hero or join the hero carousel.
const top = { angle: 'top' as const, is_generated: false, images: { url: 'top.jpg' } };
assert.equal(heroPicture([top, { ...sketch, angle: 'hero' as const }])?.url, 'sketch.png');
assert.deepEqual(orderedPictures([top, photoB]).map((p) => p.url), ['b.jpg']);
assert.equal(heroPicture([top]), null);

// A borrowed photo keeps its credit and source; others have none.
const borrowed = { is_generated: false, images: { url: 'c.jpg', credit: 'Imbibe', source_url: 'https://imbibemagazine.com/x' } };
assert.equal(heroPicture([borrowed])?.credit, 'Imbibe');
assert.equal(heroPicture([borrowed])?.sourceUrl, 'https://imbibemagazine.com/x');
assert.equal(heroPicture([photoB])?.credit, null);

// A batch borrows its drink's photos until it has one of its own.
assert.equal(batchedDrinkKey('Aperol Fizz Batch'), 'aperol fizz');
assert.equal(batchedDrinkKey('Apérol Fizz (Batch)'), 'aperol fizz');
assert.equal(batchedDrinkKey('Gin Martini - batched'), 'gin martini');
assert.equal(batchedDrinkKey('Four Roses Small Batch Bourbon'), null);
assert.equal(batchedDrinkKey('Batch'), null);
assert.equal(heroPicture(withDrinkPhotos([sketch], [photoB, { ...sketch, images: { url: 'drink-sketch.png' } }]))?.url, 'b.jpg');
assert.deepEqual(orderedPictures(withDrinkPhotos([sketch], [{ ...sketch, images: { url: 'drink-sketch.png' } }])).map((p) => p.url), ['sketch.png']);
assert.equal(heroPicture(withDrinkPhotos([photoA], [photoB]))?.url, 'a.jpg');
assert.equal(heroPicture(withDrinkPhotos(null, [photoB]))?.url, 'b.jpg');

console.log('itemImages.check: ok');
