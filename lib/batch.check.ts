// Checks for lib/batch.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildBatch, clampServes, classifyMethod, formatVolume } from './batch';
import { specLines } from './spec';

const row = (id: string, name: string, amount: number | null, unit: string | null) => ({
  id,
  amount,
  unit,
  display_ingredient_id: id,
  display_ingredient: { id, name },
});

// Method names as they're stored.
assert.equal(classifyMethod(['Stir']), 'stirred');
assert.equal(classifyMethod(['Shake']), 'shaken');
assert.equal(classifyMethod(['shake and top']), 'shaken');
assert.equal(classifyMethod(['dry shake and shake']), 'shaken');
assert.equal(classifyMethod(['Build']), 'built');
assert.equal(classifyMethod(['Build', 'Stir']), 'stirred', 'built and stirred in the glass still gets water');
assert.equal(classifyMethod(['Blitz']), 'unknown');
assert.equal(classifyMethod([]), 'unknown');

// The brief's Batch mockup: a House Martini for 24.
const martini = specLines([row('gin', 'Plymouth Gin', 60, 'ml'), row('dry', 'Dolin Dry vermouth', 15, 'ml'), row('bit', 'Orange bitters', 1, 'dash')]);
const m = buildBatch(martini, ['Stir'], 24);
assert.deepEqual(m.lines.map((l) => l.amount), ['1.44 L', '360 ml', '19 ml']);
assert.equal(m.lines[2].sub, '24 dashes', 'big dash counts show in ml with the count underneath');
assert.equal(m.water?.amount, '364 ml', '20% of the batched volume');
assert.equal(m.total, '2.18 L');
assert.equal(m.bottles, 3);
assert.match(m.note, /364 ml of filtered water \(20% dilution\)/);
assert.equal(buildBatch(martini, ['Stir'], 24, { bottleSize: 1000 }).bottles, 3);
assert.equal(buildBatch(martini, ['Stir'], 20, { bottleSize: 1000 }).bottles, 2);

// Small counts stay dashes.
const four = buildBatch(martini, ['Stir'], 4);
assert.equal(four.lines[2].amount, '4 dashes');
assert.equal(four.lines[2].sub, null);
assert.equal(buildBatch(martini, ['Stir'], 1).lines[2].amount, '1 dash');

// Shaken: the lime stays out of the bottle and there's no water.
const daiquiri = specLines([row('rum', 'White rum', 60, 'ml'), row('lime', 'Lime juice', 22.5, 'ml'), row('syr', 'Simple syrup', 15, 'ml')]);
const d = buildBatch(daiquiri, ['Shake'], 10);
assert.equal(d.water, null);
assert.equal(d.lines[1].leaveOut, 'citrus');
assert.equal(d.lines[1].amount, '225 ml', 'still says how much juice to squeeze');
assert.equal(d.total, '750 ml');
assert.equal(d.bottles, 1);
assert.match(d.note, /Batch the White rum and Simple syrup only\. Juice the citrus fresh/);

// Built: never the bubbles.
const paloma = specLines([row('teq', 'Tequila', 50, 'ml'), row('lime', 'Lime juice', 15, 'ml'), row('soda', 'Grapefruit soda', 120, 'ml')]);
const p = buildBatch(paloma, ['Build'], 12);
assert.deepEqual(p.lines.map((l) => l.leaveOut), [null, 'citrus', 'bubbles']);
assert.equal(p.total, '600 ml');
assert.match(p.note, /Top with Grapefruit soda to order; never batch the bubbles/);

// Egg, garnish counts, cordials and missing amounts.
const sour = specLines([
  row('w', 'Bourbon', 2, 'oz'),
  row('c', 'Lime cordial', 20, 'ml'),
  row('e', 'Egg white', 1, 'each'),
  row('a', 'Aquafaba', 20, 'ml'),
  row('t', 'Lemon', 1, 'twist'),
  row('x', 'Salt', null, null),
]);
const s = buildBatch(sour, ['dry shake and shake'], 6, { unit: 'oz' });
assert.deepEqual(s.lines.map((l) => l.leaveOut), [null, null, 'garnish', 'dairy', 'garnish', null]);
assert.deepEqual(s.lines.map((l) => l.amount), ['12 oz', '4 oz', '6 each', '4 oz', '6 twists', '']);
assert.equal(Math.round(s.totalMl), Math.round(12 * 29.57 + 120), 'only bottled volume counts');

// Formatting and serves.
assert.equal(formatVolume(22.5, 'ml'), '22.5 ml');
assert.equal(formatVolume(4.8, 'ml'), '4.8 ml');
assert.equal(formatVolume(2000, 'ml'), '2 L');
assert.equal(formatVolume(60, 'oz'), '2 oz');
assert.equal(formatVolume(22.5, 'oz'), '0.75 oz');
assert.equal(formatVolume(2183, 'oz'), '73.8 oz');
assert.equal(clampServes(0), 1);
assert.equal(clampServes(999), 60);
assert.equal(clampServes(Number.NaN), 1);
assert.equal(clampServes(7.6), 8);

// A locked spec (no amounts) scales to nothing rather than inventing numbers.
const locked = buildBatch(specLines([row('gin', 'Gin', null, null)]), ['Stir'], 10);
assert.equal(locked.totalMl, 0);
assert.equal(locked.bottles, 0);

console.log('batch: ok');
