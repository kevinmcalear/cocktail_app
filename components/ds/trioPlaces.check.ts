import assert from 'node:assert/strict';

import { trioLayout, trioPlaces } from './trioPlaces';

// The canvas's trio (Prod-phone and Menu-page): 160, 206, 160 on a menu page,
// at 0.82 on staff Tonight, the outer two lowered by a quarter of the middle.

const page = trioLayout();
assert.deepEqual(page, { x: [0, 88, 222], y: [49, 0, 49], s: [160, 206, 160] });

const tonight = trioLayout(0.82);
assert.deepEqual(tonight.s, [131, 169, 131]);
assert.deepEqual(tonight.x, [0, 88, 222]);

const three = trioPlaces(3, page);
assert.equal(three.width, 382);
assert.equal(three.height, 209);
assert.deepEqual(three.places.map((p) => p.drawn), ['tile', 'middle', 'tile']);
assert.deepEqual(three.places.map((p) => p.front), [false, true, false]);

// Smaller (Tonight): still centred on the middle drawing.
const small = trioPlaces(3, tonight);
const mid = small.places[1];
assert.equal(mid.x + mid.s / 2, small.width / 2);
assert.equal(small.width, 361);
assert.deepEqual(small.places.map((p) => p.x), [8, 96, 230]);

// One drink takes the middle place, at the fourth size.
const one = trioPlaces(1, page);
assert.deepEqual(one.places, [{ x: 0, y: 0, s: 206, drawn: 'middle', front: true }]);
assert.equal(one.width, 206);

// Two take the outer places, closer together, level.
const two = trioPlaces(2, page);
assert.deepEqual(two.places.map((p) => [p.x, p.y, p.s]), [[0, 0, 160], [88, 0, 160]]);

assert.equal(trioPlaces(0, page).places.length, 0);
assert.equal(trioPlaces(5, page).places.length, 3);

console.log('trioPlaces: ok');
