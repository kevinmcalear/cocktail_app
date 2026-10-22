import assert from 'node:assert/strict';

import {
  addedLine,
  clampRect,
  isStockable,
  pouredLine,
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
assert.equal(formatPar(1, 'bottles'), '1 bottle');
assert.equal(formatPar(2, 'bottles'), '2 bottles');
assert.equal(formatPar(null, 'L'), null);
assert.equal(formatPar(2, null), null);
assert.equal(summaryLine(12, [{ item_id: 'a' }, { item_id: 'a' }, { item_id: 'b' }], 4), '12 zones · 2 items placed · 4 waiting');
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
  used.map((i) => [i.id, i.drinks]),
  [
    ['scotch', ['penicillin']],
    ['lemon', ['penicillin', 'martini']],
    ['syrup', ['penicillin']],
    ['gin', ['martini']],
    ['honey', ['penicillin']],
    ['ginger', ['penicillin']],
  ],
  'each says which drinks pour it, through a house-made syrup too'
);

// Bottles put on the back bar wait first, newest first; then what the menus pour. Each once.
const NOW = Date.parse('2026-10-22T12:00:00Z');
const names: Record<string, string> = { penicillin: 'Penicillin', martini: 'Martini' };
const stockRows = [
  { item_id: 'mezcal', source: 'drink', from_name: 'Ash Garden', added_at: '2026-10-22T11:58:00Z', item: { id: 'mezcal', name: 'Del Maguey Vida' } },
  { item_id: 'gin', source: 'setup', from_name: null, added_at: '2026-10-21T09:00:00Z', item: { id: 'gin', name: 'Gin' } },
  { item_id: 'placed', source: 'drink', from_name: 'Low Tide', added_at: '2026-10-20T09:00:00Z', item: { id: 'placed', name: 'Campari' } },
  { item_id: 'hidden', source: 'drink', from_name: null, added_at: '2026-10-20T09:00:00Z', item: null },
];
assert.deepEqual(
  waitingForSpot(stockRows, used, [{ item_id: 'scotch' }, { item_id: 'syrup' }, { item_id: 'placed' }], (id) => names[id], NOW),
  [
    { id: 'mezcal', name: 'Del Maguey Vida', detail: 'Added from Ash Garden, just now' },
    { id: 'gin', name: 'Gin', detail: 'Added in setup, yesterday' },
    { id: 'lemon', name: 'Lemon juice', detail: 'Poured in 2 drinks' },
    { id: 'honey', name: 'Honey', detail: 'Poured in Penicillin' },
    { id: 'ginger', name: 'Ginger', detail: 'Poured in Penicillin' },
  ]
);
assert.equal(addedLine({ source: 'back_bar', from_name: null, added_at: '2026-10-19T09:00:00Z' }, NOW), 'Added 3 days ago');
assert.equal(addedLine({ source: 'drink', from_name: '  ', added_at: '2026-10-22T11:00:00Z' }, NOW), 'Added today');
assert.equal(pouredLine(['x'], () => undefined), 'Poured in 1 drink');

// --- which lines get the bottle ---
assert.equal(isStockable({ name: 'Del Maguey Vida', kind: 'Mezcal', role: 'product' }), true);
assert.equal(isStockable({ name: 'Sweet vermouth', role: 'generic' }), true);
assert.equal(isStockable({ name: 'Agave syrup', role: 'generic' }), true, 'a bought syrup');
assert.equal(isStockable({ name: 'Agave syrup', role: 'prep' }), true, 'the catalog files syrups as preps; a bar can still buy one');
assert.equal(isStockable({ name: 'Monin pandan', role: 'product' }), true, 'a branded bottle');
assert.equal(isStockable({ name: 'Fever-Tree tonic', role: 'product' }), false, 'a mixer');
assert.equal(isStockable({ name: 'Angostura bitters', role: 'product' }), true);
assert.equal(isStockable({ name: 'Lime juice', role: 'generic' }), false);
assert.equal(isStockable({ name: 'Mint', role: 'generic' }), false);
assert.equal(isStockable({ name: 'Soda water', role: 'generic' }), false);
assert.equal(isStockable({ name: 'Pandan cordial', role: 'prep', ownPrep: true }), false, "the bar's own house prep");
assert.equal(isStockable({ name: 'Lime juice', role: 'prep' }), false, 'a juice, however the catalog files it');

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
