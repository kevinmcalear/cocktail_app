// Checks for lib/drinkPhotos.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { photoCredit } from './drinkPhotos';

const jo = { name: 'Jo' };
assert.equal(photoCredit({ isMine: false, poster: jo, score: null }), 'Photo by Jo');
assert.equal(photoCredit({ isMine: false, poster: jo, score: 8.44 }), 'Photo by Jo · ranked it 8.4');
assert.equal(photoCredit({ isMine: false, poster: jo, score: 10 }), 'Photo by Jo · ranked it 10.0');
assert.equal(photoCredit({ isMine: true, poster: jo, score: 7 }), 'Photo by you · ranked it 7.0');
assert.equal(photoCredit({ isMine: false, poster: null, score: null }), 'Photo by a guest', 'a private profile is never named');

console.log('drinkPhotos ok');
