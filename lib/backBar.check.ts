import assert from 'node:assert/strict';

import {
  clampRect,
  formatPar,
  kindFromName,
  freeSpot,
  ingredientsUsed,
  locationLine,
  moveRectTo,
  nudgeRect,
  overlaps,
  parsePar,
  resizeRect,
  summaryLine,
  waitingForSpot,
  zoneRect,
} from './backBar';

// The database refuses a zone that isn't whole and inside the plan.
const inside = (r: { x: number; y: number; w: number; h: number }) =>
  r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && Math.fround(r.x) + Math.fround(r.w) <= 1 && Math.fround(r.y) + Math.fround(r.h) <= 1;

// --- zoneRect ---
assert.equal(zoneRect({ plan_x: null, plan_y: null, plan_w: null, plan_h: null }), null);
assert.deepEqual(zoneRect({ plan_x: 0.1, plan_y: 0.2, plan_w: 0.3, plan_h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });

// --- clamping keeps zones on the plan ---
assert.deepEqual(clampRect({ x: -0.2, y: -1, w: 0.2, h: 0.1 }), { x: 0, y: 0, w: 0.2, h: 0.1 });
const pushedRight = clampRect({ x: 0.95, y: 0.95, w: 0.2, h: 0.1 });
assert.ok(inside(pushedRight), 'pushed back inside');
assert.equal(pushedRight.w, 0.2, 'size kept when moving past the edge');
assert.ok(inside(clampRect({ x: 0, y: 0, w: 5, h: 5 })), 'too big shrinks to the plan');
assert.ok(clampRect({ x: 0.5, y: 0.5, w: 0, h: -1 }).w >= 0.04, 'never collapses to nothing');
// Float edge cases the float4 columns would trip on.
for (let x = 0; x <= 1; x += 0.037) {
  for (const w of [0.1, 0.215, 0.3, 0.7, 0.94]) assert.ok(inside(clampRect({ x, y: x, w, h: w })), `inside for x=${x} w=${w}`);
}

// --- moving and resizing ---
const fridge = { x: 0.265, y: 0.23, w: 0.215, h: 0.17 };
assert.deepEqual(nudgeRect(fridge, 0.02, 0), { ...fridge, x: 0.285 });
assert.deepEqual(nudgeRect(fridge, 0, -1), { ...fridge, y: 0 });
assert.deepEqual(resizeRect(fridge, 0.02, 0.02), { ...fridge, w: 0.235, h: 0.19 });
assert.deepEqual(moveRectTo(fridge, 0.5, 0.5), { x: 0.393, y: 0.415, w: 0.215, h: 0.17 });
assert.ok(inside(moveRectTo(fridge, 1, 1)), 'tapping the corner keeps it inside');

// --- a new zone goes somewhere free ---
assert.equal(overlaps({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }), false, 'touching edges do not overlap');
assert.equal(overlaps({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.4, y: 0.4, w: 0.5, h: 0.5 }), true);
const first = freeSpot([]);
assert.deepEqual(first, { x: 0.02, y: 0.02, w: 0.2, h: 0.14 });
const second = freeSpot([first]);
assert.ok(!overlaps(first, second) && inside(second), 'the second zone does not sit on the first');
const full = freeSpot([{ x: 0, y: 0, w: 0.999, h: 0.999 }]);
assert.ok(inside(full), 'a full plan still gives a valid spot');

// --- words ---
assert.equal(locationLine('Fridge 2', 'Top shelf · left'), 'Fridge 2 · top shelf · left');
assert.equal(locationLine('Garnish', null), 'Garnish');
assert.equal(locationLine('Garnish', '  '), 'Garnish');
assert.equal(formatPar(2, 'L'), '2 L');
assert.equal(formatPar('0.750', 'L'), '0.75 L');
assert.equal(formatPar(null, 'L'), null);
assert.equal(formatPar(2, null), null);
assert.equal(summaryLine(12, [{ item_id: 'a' }, { item_id: 'a' }, { item_id: 'b' }], 3), '12 zones · 2 items placed · 3 waiting for a spot');
assert.equal(summaryLine(1, [{ item_id: 'a' }], 0), '1 zone · 1 item placed');

// --- waiting for a spot ---
const recipeOf = {
  penicillin: [
    { id: 'scotch', name: 'Blended Scotch' },
    { id: 'lemon', name: 'Lemon juice' },
    { id: 'syrup', name: 'Honey-ginger syrup' },
  ],
  martini: [
    { id: 'gin', name: 'Gin' },
    { id: 'lemon', name: 'Lemon juice' },
  ],
  syrup: [
    { id: 'honey', name: 'Honey' },
    { id: 'ginger', name: 'Ginger' },
  ],
  // A loop in the data must not hang the walk.
  ginger: [{ id: 'syrup', name: 'Honey-ginger syrup' }],
};
const used = ingredientsUsed(['penicillin', 'martini'], recipeOf);
assert.deepEqual(
  used.map((i) => i.id),
  ['scotch', 'lemon', 'syrup', 'gin', 'honey', 'ginger'],
  'every ingredient once, house-made ones walked down, in spec order'
);
assert.deepEqual(ingredientsUsed([], recipeOf), []);
assert.deepEqual(
  ingredientsUsed(['penicillin', 'syrup'], recipeOf).map((i) => i.id),
  ['scotch', 'lemon', 'honey', 'ginger'],
  'a drink never counts as its own ingredient'
);
assert.deepEqual(
  waitingForSpot(used, [{ item_id: 'scotch' }, { item_id: 'syrup' }, { item_id: 'unrelated' }]).map((i) => i.id),
  ['lemon', 'gin', 'honey', 'ginger']
);

console.log('backBar checks passed');

// --- a zone's kind from its name ---
assert.equal(kindFromName('Fridge 3'), 'fridge');
assert.equal(kindFromName('Chest freezer'), 'freezer');
assert.equal(kindFromName('Speed rail, station 1'), 'speed_rail');
assert.equal(kindFromName('Glass racks'), 'glass_rack');
assert.equal(kindFromName('Top shelf'), 'shelf');
assert.equal(kindFromName('Cellar'), 'storeroom');
assert.equal(kindFromName('The cupboard'), 'other');
console.log('kindFromName checks passed');

// --- par fields ---
assert.deepEqual(parsePar('', ''), { amount: null, unit: null });
assert.deepEqual(parsePar(' 2 ', ' L '), { amount: 2, unit: 'L' });
assert.deepEqual(parsePar('0,75', 'L'), { amount: 0.75, unit: 'L' }, 'a decimal comma works');
assert.ok(parsePar('0', 'L').error, 'zero is refused');
assert.ok(parsePar('lots', 'L').error, 'words are refused');
assert.ok(parsePar('2', '').error, 'an amount needs a unit');
assert.ok(parsePar('', 'L').error, 'a unit needs an amount');
console.log('parsePar checks passed');
