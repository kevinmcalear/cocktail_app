// Checks for lib/stock.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { countStep, countUnit, formatCount, madeLine, onHandByItem, parByItem, withBatches, zoneSummary } from './stock';

assert.equal(countStep('btl'), 0.1);
assert.equal(countStep('L'), 0.1);
assert.equal(countStep('each'), 1);
assert.equal(countStep('ml'), 50);
assert.equal(countStep(null), 1);
assert.equal(countUnit(' L '), 'L');
assert.equal(countUnit(null), 'each');
assert.equal(formatCount(1.4, 'btl'), '1.4 btl');
assert.equal(formatCount(0.8, 'L'), '800 ml');
assert.equal(formatCount(1.5, 'L'), '1.5 L');
assert.equal(formatCount(3, 'each'), '3 each');

// On hand: the latest line per spot, added up per item.
const onHand = onHandByItem([
  { item_id: 'gin', location_id: 'rail', amount: '1.5', unit: 'btl', counted_at: '2026-10-01T10:00:00Z' },
  { item_id: 'gin', location_id: 'store', amount: 4, unit: 'btl', counted_at: '2026-10-01T10:00:00Z' },
  { item_id: 'syrup', location_id: 'fridge', amount: 0.8, unit: 'L', counted_at: '2026-10-01T10:00:00Z' },
  { item_id: 'lime', location_id: 'fridge', amount: 0, unit: 'L', counted_at: '2026-10-01T10:00:00Z' },
]);
assert.deepEqual(onHand.gin, { kind: 'count', value: 5.5, unit: 'btl' });
assert.deepEqual(onHand.syrup, { kind: 'ml', value: 800, unit: 'ml' });
assert.deepEqual(onHand.lime, { kind: 'ml', value: 0, unit: 'ml' }, 'a zero count is still a count');

const par = parByItem([
  { item_id: 'gin', par_amount: 2, par_unit: 'btl', item: { name: 'Gin' } },
  { item_id: 'gin', par_amount: '6', par_unit: 'btl', item: { name: 'Gin' } },
  { item_id: 'syrup', par_amount: 2, par_unit: 'L', item: { name: 'Syrup' } },
  { item_id: 'lime', par_amount: null, par_unit: null, item: { name: 'Lime' } },
]);
assert.deepEqual(par.gin, { kind: 'count', value: 8, unit: 'btl', name: 'Gin' });
assert.deepEqual(par.syrup, { kind: 'ml', value: 2000, unit: 'ml', name: 'Syrup' });
assert.equal(par.lime, undefined);

// A zone's summary: what's short and where it goes.
const summary = zoneSummary([
  { name: 'Dolin Dry', amount: 1.4, par: 2, unit: 'btl', houseMade: false },
  { name: 'Honey-ginger syrup', amount: 0.8, par: 2, unit: 'L', houseMade: true },
  { name: 'Daiquiri batch', amount: 1.5, par: 4, unit: 'btl', houseMade: true },
  { name: 'Lime juice', amount: 1, par: 1, unit: 'L', houseMade: false },
  { name: 'Uncounted', amount: null, par: 3, unit: 'each', houseMade: false },
]);
assert.equal(summary.short.length, 3);
assert.equal(summary.sentence, '3 short in this zone. Honey-ginger syrup and Daiquiri batch go on today’s prep list; Dolin Dry goes on the order list.');
assert.equal(zoneSummary([{ name: 'Gin', amount: 3, par: 2, unit: 'btl', houseMade: false }]).sentence, 'Nothing short in this zone.');
assert.equal(zoneSummary([{ name: 'Gin', amount: null, par: 2, unit: 'btl', houseMade: false }]).sentence, 'Count each spot to see what is short.');

console.log('stock: ok');

// On hand with batches: the last count plus batches made since; older batches sit under the count.
{
  const counted = [{ item_id: 'g', location_id: null, amount: 200, unit: 'ml', counted_at: '2026-11-01T12:00:00Z' }];
  const batch = (id: string, amount: number, unit: string, madeAt: string) => ({ id, itemId: 'g', amount, unit, madeAt, madeBy: null });
  const before = batch('a', 1, 'L', '2026-11-01T10:00:00Z');
  const after = batch('b', 1, 'L', '2026-11-01T15:00:00Z');
  assert.equal(withBatches(counted, [before, after]).g.value, 1200, '200 ml counted + 1 L made since; the morning batch is in the count');
  assert.equal(withBatches([], [before]).g.value, 1000, 'never counted: every batch');
  assert.equal(withBatches(counted, [batch('c', 2, 'btl', '2026-11-01T16:00:00Z')]).g.value, 200, 'another kind of unit is left out');
}

// A house-made row's value: last made and what's on hand (boards Draw-scroll, Desk-page).
{
  const ml = (value: number) => ({ kind: 'ml' as const, value, unit: 'ml' });
  assert.match(madeLine({ madeAt: '2026-10-30T15:00:00Z' }, ml(800)) ?? '', /^Made .*30.* · 800 ml left$/);
  assert.match(madeLine({ madeAt: '2026-10-30T15:00:00Z' }, undefined) ?? '', /^Made .*30/);
  assert.equal(madeLine(undefined, ml(1500)), '1.5 L left');
  assert.equal(madeLine(undefined, ml(0)), 'None left');
  assert.equal(madeLine(undefined, undefined), null);
}
