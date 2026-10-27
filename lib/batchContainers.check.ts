// Checks for batching every part ahead (board made-parts-making): lib/batchContainers.ts
// and lib/drinkParts.ts setPartFresh. Run: npm run test:unit
import assert from 'node:assert/strict';

import {
  aheadParts,
  containerText,
  fromContainer,
  inOrderSteps,
  keepsLabel,
  madeAhead,
  ownContainer,
  partKeeps,
  partWord,
  pickContainer,
  TONIGHT_HOURS,
  expiresOn,
  expiresText,
} from './batchContainers';
import { makingParts, setPartFresh, storedParts } from './drinkParts';
import { specLines } from './spec';

// An Irish Coffee: the coffee built in the glass, then cream whipped and floated on it.
const stored = [{ name: 'The coffee' }, { name: 'The cream', join: 'float' as const }];
const methods = [
  { part: 1, sort_order: 0, method: { name: 'Build' } },
  { part: 2, sort_order: 1, method: { name: 'Whip (whisk or frother)' } },
];
const parts = makingParts(stored, methods)!;
const ing = (id: string, name: string, amount: number, part: number, extra: object = {}) => ({
  id, part, amount, unit: 'ml', display_ingredient_id: id, display_ingredient: { id, name, abv: null, ingredient_role: null }, ...extra,
});
const lines = specLines([ing('w', 'Irish whiskey', 40, 1), ing('c', 'Hot coffee', 120, 1, { at_service: true }), ing('d', 'Demerara syrup', 15, 1), ing('k', 'Cream', 30, 2)] as never);

// Made ahead is the default; made fresh is stored on the part, and never on the first.
assert.equal(parts[1].fresh, undefined);
assert.equal(madeAhead(parts[0]), false, 'part 1 is the bottle');
assert.equal(madeAhead(parts[1]), true);
const fresh = setPartFresh(stored, 2, true);
assert.deepEqual(fresh, [{ name: 'The coffee' }, { name: 'The cream', join: 'float', fresh: true }]);
assert.equal(madeAhead(makingParts(fresh, methods)![1]), false);
assert.deepEqual(setPartFresh(fresh, 2, false), stored, 'back to made ahead drops the key');
assert.deepEqual(setPartFresh(stored, 1, true), stored, 'the first part is always the bottle');
assert.equal(makingParts([{ name: 'A', fresh: true }, { name: 'B' }], [])![0].fresh, undefined);
// The wizard and editor keep it on a later part.
assert.deepEqual(storedParts([{ name: 'A', lines: [], methods: [], fresh: true }, { name: 'B', join: 'float', lines: [], methods: [], fresh: true }]), [{ name: 'A' }, { name: 'B', join: 'float', fresh: true }]);

// 12 serves: the cream, 360 ml, goes in its own container, whipped, 30 ml a serve.
const [cream] = aheadParts(lines, parts, 12, 'ml');
assert.equal(cream.part.name, 'The cream');
assert.deepEqual(cream.rows.map((r) => [r.amount, r.ingredient]), [['360 ml', 'Cream']]);
assert.equal(cream.total, '360 ml');
assert.equal(cream.pour, '30 ml');
assert.equal(cream.whipped, true);
assert.deepEqual(aheadParts(lines, makingParts(fresh, methods)!, 12, 'ml'), [], 'a fresh part has no container');
// A count (a twist), the bubbles and a line the bar keeps at the station stay per serve, out of the container.
const twist = specLines([ing('w', 'Gin', 50, 1), { ...ing('t', 'Lemon twist', 1, 2), unit: 'twist' }, ing('s', 'Soda water', 60, 2), ing('h', 'Honey syrup', 15, 2), ing('c', 'Hot water', 30, 2, { at_service: true })] as never);
const topParts = makingParts([{ name: 'Base' }, { name: 'Top', join: 'pour' }], [])!;
const [top] = aheadParts(twist, topParts, 4, 'ml');
assert.deepEqual(top.rows.map((r) => r.ingredient), ['Honey syrup']);
assert.deepEqual(top.perServe.map((r) => r.ingredient), ['Lemon twist', 'Soda water', 'Hot water']);
assert.equal(top.whipped, false);
// A part with nothing to keep (a garnish, the bubbles) gets no container.
assert.deepEqual(aheadParts(specLines([ing('w', 'Gin', 50, 1), { ...ing('t', 'Lemon twist', 1, 2), unit: 'twist' }] as never), topParts, 4, 'ml'), []);
// The pour is for the serves as scaled (held to 1 to 6,969).
assert.equal(aheadParts(lines, parts, 0, 'ml')[0].pour, '30 ml');

// Containers: ours, the smallest that holds it; whipped goes in a tub; too big takes several.
assert.equal(containerText(pickContainer(360, [], true).count, pickContainer(360, [], true).container), '1 × 500 ml deli container');
assert.equal(pickContainer(360, [], false).container.name, '500 ml squeeze bottle');
assert.equal(pickContainer(600, [], false).container.name, '700 ml bottle');
assert.equal(pickContainer(800, [], false).container.name, '1 L deli container');
assert.deepEqual(pickContainer(2400, [], false), { count: 3, container: { ml: 1000, name: '1 L deli container' } });
// The venue's own come first, read from its Kit's names.
assert.deepEqual(ownContainer('1 L cambro'), { ml: 1000, name: '1 L cambro' });
assert.deepEqual(ownContainer('Squeeze bottle 16 oz'), { ml: 473, name: 'Squeeze bottle 16 oz' });
assert.deepEqual(ownContainer('Quart deli'), { ml: 946, name: 'Quart deli' });
assert.deepEqual(ownContainer('250ml jar'), { ml: 250, name: '250ml jar' });
assert.equal(ownContainer('Jigger'), null);
assert.equal(ownContainer('Deli container'), null, 'no size, no use');
assert.equal(ownContainer('Boston shaker pint'), null, 'a shaker is not where a part is kept');
assert.equal(ownContainer('Pint glass'), null);
const own = [ownContainer('Quart deli')!, ownContainer('250ml jar')!];
assert.equal(pickContainer(200, own, false).container.name, '250ml jar');
assert.equal(pickContainer(360, own, true).container.name, 'Quart deli');
assert.deepEqual(pickContainer(2000, own, false), { count: 3, container: { ml: 946, name: 'Quart deli' } });

// Use-by: the part's own lines, the shortest; cream is close tonight; a house syrup keeps its days.
const now = new Date(2026, 9, 27, 15);
assert.equal(partKeeps(cream.lines, {}), TONIGHT_HOURS);
assert.equal(expiresText(partKeeps(cream.lines, {}), now), 'use by close tonight');
const syrup = specLines([{ ...ing('d', 'Demerara syrup', 15, 1), display_ingredient: { id: 'd', name: 'Demerara syrup', abv: null, ingredient_role: 'prep' } }] as never);
assert.equal(syrup[0].houseMade, true);
assert.equal(partKeeps(syrup, { d: 336 }), 336);
assert.equal(expiresText(336, now), 'use by Tue 10 Nov');
assert.equal(partKeeps(specLines([ing('w', 'Irish whiskey', 40, 1)] as never), {}), null, 'spirits keep');
assert.equal(expiresText(null, now), null);
assert.equal(expiresOn(TONIGHT_HOURS, now).getDate(), 27, 'tonight is today');
assert.deepEqual([12, 24, 72, 168, 336, 672].map(keepsLabel), ['close tonight', '1 day', '3 days', '1 week', '2 weeks', '4 weeks']);

// At the station.
assert.equal(partWord('The cream'), 'cream');
assert.equal(partWord('Part 2'), 'part 2');
assert.equal(fromContainer(['Whip (whisk or frother)']), 'From its container, already whipped');
assert.equal(fromContainer([]), 'From its container, made ahead');
assert.deepEqual(
  inOrderSteps([
    { part: parts[0], pour: '55 ml', lines: [{ amount: '120 ml', ingredient: 'Hot coffee' }] },
    { part: parts[1], pour: '30 ml', lines: [], whipped: true },
  ]),
  ['Pour 55 ml from the coffee bottle', 'Add 120 ml Hot coffee', 'Spoon 30 ml from the cream container', 'Float it on top']
);
// A part made fresh says so in one step, then its join.
assert.deepEqual(inOrderSteps([{ part: parts[1], pour: null, lines: [{ amount: '30 ml', ingredient: 'Cream' }] }]), ['Make cream fresh: 30 ml Cream', 'Float it on top']);
