import assert from 'node:assert/strict';

import { addPhotos, photoUris, roomFor, setAngle } from './photoAngles';

// "Which is which?" (add wizard, E26): several photos at once, one angle each.

// Picked three at once: the first is the Hero, then Side and Top.
const three = addPhotos({}, ['a', 'b', 'c']);
assert.deepEqual(three, { hero: 'a', side: 'b', top: 'c' });
assert.equal(roomFor(three), 2);
// More than fit: the rest are left out.
assert.deepEqual(Object.keys(addPhotos(three, ['d', 'e', 'f'])).length, 5);
// Added later, they take the free angles; the Hero stays.
assert.deepEqual(addPhotos({ hero: 'a', top: 'c' }, ['d']), { hero: 'a', top: 'c', side: 'd' });

// Making b the Hero swaps it with a.
assert.deepEqual(setAngle(three, 'b', 'hero'), { hero: 'b', side: 'a', top: 'c' });
// To a free angle: it moves, leaving its old one free.
assert.deepEqual(setAngle(three, 'c', 'garnish'), { hero: 'a', side: 'b', garnish: 'c' });
// The same angle again changes nothing.
assert.equal(setAngle(three, 'a', 'hero'), three);

// The rows list in angle order, whatever order they were added.
assert.deepEqual(photoUris({ top: 'c', hero: 'a', handoff: 'e' }), ['a', 'c', 'e']);

console.log('photoAngles.check: ok');
