// Checks for making a drink in parts (board made-parts-making): lib/drinkParts.ts
// makingParts, byPart, joinStep and lib/service.ts serviceParts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { byPart, joinStep, makingParts, partOf } from './drinkParts';
import { serviceParts } from './service';
import { specLines } from './spec';

// An Irish Coffee: the coffee built in the glass, then cream whipped and floated on it.
const stored = [{ name: 'The coffee' }, { name: 'The cream', join: 'float' as const }];
const methods = [
  { part: 2, sort_order: 1, method: { name: 'Whip (whisk or frother)' } },
  { part: 1, sort_order: 0, method: { name: 'Build' } },
];
const parts = makingParts(stored, methods)!;
assert.deepEqual(parts, [
  { n: 1, name: 'The coffee', methods: ['Build'], how: 'Build in the glass', join: null },
  { n: 2, name: 'The cream', methods: ['Whip (whisk or frother)'], how: 'Whip with a whisk or frother', join: 'float' },
]);
// One part is no parts, and a part with no method says nothing about how.
assert.equal(makingParts(null, methods), null);
assert.equal(makingParts([{ name: 'Only' }], methods), null);
assert.equal(makingParts(stored, [])![1].how, null);
// The first part never joins, whatever was stored.
assert.equal(makingParts([{ name: 'A', join: 'pour' }, { name: 'B', join: 'pour' }], [])![0].join, null);

// A line in no part is in the first; one past the last (never saved) is in the last.
assert.equal(partOf(null, 2), 1);
assert.equal(partOf(5, 2), 2);
assert.deepEqual(byPart([{ k: 'a', part: 1 }, { k: 'b', part: null }, { k: 'c', part: 2 }, { k: 'd', part: 3 }], 2).map((g) => g.map((l) => l.k)), [['a', 'b'], ['c', 'd']]);

assert.equal(joinStep('float'), 'Float it on top');
assert.equal(joinStep('pour'), 'Pour it in');
assert.equal(joinStep(null), null);

const row = (id: string, name: string, amount: number, part: number, at_service: boolean | null = null) => ({
  id,
  amount,
  unit: 'ml',
  part,
  at_service,
  display_ingredient_id: id,
  display_ingredient: { id, name },
});
const lines = specLines([row('w', 'Irish whiskey', 40, 1), row('c', 'Hot coffee', 120, 1, true), row('d', 'Demerara syrup', 15, 1), row('k', 'Cream', 30, 2)]);
assert.deepEqual(lines.map((l) => l.part), [1, 1, 1, 2]);

// Made to order: every line at the station, part by part, in the spec's order.
const toOrder = serviceParts(lines, parts, false);
assert.deepEqual(toOrder.map((p) => [p.pour, p.lines.map((l) => `${l.amount} ${l.ingredient}`)]), [
  [null, ['40 ml Irish whiskey', '120 ml Hot coffee', '15 ml Demerara syrup']],
  [null, ['30 ml Cream']],
]);

// Batched: part 1 is its pour from the bottle and what's added to it; the cream is made fresh,
// even though the guess would never batch it anyway, and even if the bar marked it for the batch.
const batched = serviceParts(specLines([row('w', 'Irish whiskey', 40, 1), row('c', 'Hot coffee', 120, 1, true), row('d', 'Demerara syrup', 15, 1), row('k', 'Cream', 30, 2, false)]), parts, true);
assert.equal(batched[0].pour, '55 ml');
assert.deepEqual(batched[0].lines.map((l) => l.ingredient), ['Hot coffee']);
assert.deepEqual(batched[1].lines.map((l) => l.ingredient), ['Cream']);
assert.equal(batched[1].pour, null);
assert.equal(batched[1].join, 'float');

console.log('making parts: ok');
