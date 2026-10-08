// Checks for lib/drinkPhotos.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { heroPictures, photoCredit } from './drinkPhotos';

const jo = { name: 'Jo' };
assert.equal(photoCredit({ isMine: false, poster: jo, score: null }), 'Photo by Jo');
assert.equal(photoCredit({ isMine: false, poster: jo, score: 8.44 }), 'Photo by Jo · ranked it 8.4');
assert.equal(photoCredit({ isMine: false, poster: jo, score: 10 }), 'Photo by Jo · ranked it 10.0');
assert.equal(photoCredit({ isMine: true, poster: jo, score: 7 }), 'Photo by you · ranked it 7.0');
assert.equal(photoCredit({ isMine: false, poster: null, score: null }), 'Photo by a guest', 'a private profile is never named');

console.log('drinkPhotos ok');

// --- heroPictures ---
const sketch = { url: 's.png', isSketch: true, isOutdated: false, credit: null, sourceUrl: null };
const real = { url: 'r.jpg', isSketch: false, isOutdated: false, credit: 'Bar Bellamy', sourceUrl: null };
const joPhoto = { imageUrl: 'jo.jpg', isMine: false, poster: jo, score: 9.2 };
assert.deepEqual(heroPictures([real], [joPhoto]), { pictures: [real], credit: 'Photo: Bar Bellamy' }, "the drink's own photo stays the hero");
const led = heroPictures([sketch], [joPhoto, { ...joPhoto, imageUrl: 'older.jpg' }]);
assert.deepEqual(led.pictures.map((p) => p.url), ['jo.jpg', 's.png'], 'the newest person photo leads, the sketch stays behind it');
assert.equal(led.credit, 'Photo by Jo · ranked it 9.2');
assert.equal(heroPictures([], [joPhoto]).pictures.length, 1, 'no pictures at all: theirs');
assert.deepEqual(heroPictures([sketch], []), { pictures: [sketch], credit: null });
assert.deepEqual(heroPictures([sketch], undefined), { pictures: [sketch], credit: null }, 'signed out: no person photos');

console.log('drinkPhotos hero ok');
