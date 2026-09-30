// Checks for lib/stock.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { countStep, countUnit, formatCount, onHandByItem, parByItem, zoneSummary } from './stock';

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
