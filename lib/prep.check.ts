// Checks for lib/prep.ts and lib/quantity.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildPrepList, servesPerDrink } from './prep';
import { formatQuantity, toQuantity } from './quantity';

assert.equal(formatQuantity(toQuantity(1.5, 'L')!), '1.5 L');
assert.equal(formatQuantity(toQuantity(2, 'oz')!), '59.1 ml');
assert.equal(toQuantity(null, 'ml'), null);
assert.deepEqual(toQuantity(3, 'Limes'), { kind: 'count', value: 3, unit: 'limes' });

const startsAt = new Date('2026-10-03T19:00:00+10:00');
const list = buildPrepList({
  startsAt,
  now: new Date(startsAt.getTime() - 3 * 24 * 60 * 60_000),
  servesPerDrink: 40,
  drinks: [
    {
      id: 'pen',
      name: 'Penicillin',
      recipe: [
        { ingredientId: 'scotch', name: 'Blended Scotch', amount: 60, unit: 'ml' },
        { ingredientId: 'lemon', name: 'Lemon juice', amount: 22.5, unit: 'ml' },
        { ingredientId: 'hgs', name: 'Honey-ginger syrup', amount: 22.5, unit: 'ml' },
      ],
    },
    {
      id: 'gold',
      name: 'Gold Rush',
      recipe: [
        { ingredientId: 'bourbon', name: 'Bourbon', amount: 2, unit: 'oz' },
        { ingredientId: 'lemon', name: 'Lemon juice', amount: 0.75, unit: 'oz' },
      ],
    },
  ],
  houseMade: {
    // 750 ml per batch; needs 40 × 22.5 = 900 ml → 2 batches.
    hgs: {
      yieldAmount: 750,
      yieldUnit: 'ml',
      leadTimeMinutes: 60,
      leadTimeNote: 'Cool before bottling',
      recipe: [
        { ingredientId: 'honey', name: 'Honey', amount: 500, unit: 'g' },
        { ingredientId: 'ginger', name: 'Fresh ginger juice', amount: 150, unit: 'ml' },
      ],
    },
  },
  purchasing: {
    scotch: { supplierName: 'Bottle Co', packAmount: 700, packUnit: 'ml' },
    honey: { supplierName: 'Market', packAmount: 1, packUnit: 'kg' },
  },
});

const hgs = list.make.find((m) => m.id === 'hgs')!;
assert.equal(hgs.needed, '900 ml');
assert.equal(hgs.batches, '2 batches of 750 ml');
assert.equal(hgs.startBy?.toISOString(), new Date(startsAt.getTime() - 60 * 60_000).toISOString());
assert.equal(hgs.urgent, false, 'three days out, nothing is urgent');
assert.equal(hgs.late, false);

const line = (id: string) => list.order.flatMap((g) => g.lines).find((l) => l.id === id)!;
assert.equal(line('scotch').needed, '2.4 L', '40 × 60 ml');
assert.equal(line('scotch').packs, '4 × 700 ml', 'rounded up to whole bottles');
assert.equal(line('lemon').needed, '1.8 L', 'ml and oz lines for the same ingredient add up');
assert.equal(line('honey').needed, '1 kg', 'two batches of 500 g');
assert.equal(line('honey').packs, '1 × 1 kg');
assert.equal(line('ginger').needed, '300 ml');
assert.ok(!list.order.flatMap((g) => g.lines).some((l) => l.id === 'hgs'), 'house-made items are made, not ordered');
assert.equal(list.order.at(-1)?.supplier, 'No supplier yet', 'unassigned items come last');

// A cycle (A made from B made from A) stops instead of looping.
const cyclic = buildPrepList({
  startsAt,
  now: startsAt,
  servesPerDrink: 1,
  drinks: [{ id: 'd', name: 'D', recipe: [{ ingredientId: 'a', name: 'A', amount: 10, unit: 'ml' }] }],
  houseMade: {
    a: { yieldAmount: 10, yieldUnit: 'ml', leadTimeMinutes: null, leadTimeNote: null, recipe: [{ ingredientId: 'b', name: 'B', amount: 10, unit: 'ml' }] },
    b: { yieldAmount: 10, yieldUnit: 'ml', leadTimeMinutes: null, leadTimeNote: null, recipe: [{ ingredientId: 'a', name: 'A', amount: 10, unit: 'ml' }] },
  },
  purchasing: {},
});
assert.equal(cyclic.make.length, 2);

// Starting at service time with a lead time means it's already late.
const late = buildPrepList({
  startsAt,
  now: new Date(startsAt.getTime() - 30 * 60_000),
  servesPerDrink: 1,
  drinks: [{ id: 'd', name: 'D', recipe: [{ ingredientId: 'x', name: 'X', amount: 10, unit: 'ml' }] }],
  houseMade: { x: { yieldAmount: 10, yieldUnit: 'ml', leadTimeMinutes: 60, leadTimeNote: null, recipe: [] } },
  purchasing: {},
});
assert.equal(late.make[0].late, true, 'an hour-long prep 30 minutes before service is late');
assert.equal(late.make[0].urgent, true);

assert.equal(servesPerDrink(140, 9), 32, '140 guests × 2 drinks over 9 drinks');
assert.equal(servesPerDrink(0, 9), 0);

console.log('prep: ok');
