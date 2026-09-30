// Checks for lib/calculators.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { ethanolIn, formatMl, readings, spiritToProof, waterToDilute } from './calculators';

const near = (a: number | null, b: number, msg?: string) => assert.ok(a !== null && Math.abs(a - b) < 0.05, `${msg ?? ''} expected ${b}, got ${a}`);

// 700 ml at 40% down to 28%: 300 ml of water, since the ethanol (280 ml) doesn't move.
near(waterToDilute(700, 40, 28), 300);
near(ethanolIn(700, 40), 280);
near(ethanolIn(1000, 28), 280, 'the same ethanol in the diluted litre');
assert.equal(waterToDilute(700, 40, 40), null, 'nothing to do');
assert.equal(waterToDilute(700, 40, 45), null, 'water cannot raise it');
assert.equal(waterToDilute(0, 40, 28), null);

// Fortifying: 500 ml of cordial at 18% up to 22% with 96% spirit takes 27 ml.
near(spiritToProof(500, 18, 22, 96), 27.03);
near(spiritToProof(1000, 0, 15, 40), 600, 'a litre of juice to 15% with vodka');
assert.equal(spiritToProof(500, 18, 15, 96), null, 'the target has to be above what you have');
assert.equal(spiritToProof(500, 18, 22, 20), null, 'and below the spirit');

// Readings: 50 g of rum through its density, an ounce in ml, a count has none.
const rum = readings(50, 'g', { name: 'White rum', abv: 40 });
assert.deepEqual(rum.map((r) => r.unit), ['ml', 'oz', 'cl', 'bsp'], 'no gram reading of grams, no dashes over 10 ml');
assert.equal(rum[0].label, '52.7 ml');
assert.equal(rum[1].label, '1.78 oz');
const oz = readings(2, 'oz');
assert.equal(oz.find((r) => r.unit === 'ml')!.label, '59.1 ml');
assert.equal(oz.find((r) => r.unit === 'g')!.label, '59.1 g', 'water density without an ingredient');
assert.ok(!oz.some((r) => r.unit === 'oz'));
const dash = readings(1, 'dash');
assert.equal(dash.find((r) => r.unit === 'ml')!.label, '0.8 ml');
assert.ok(!dash.some((r) => r.unit === 'dashes'), 'a dash is not read in dashes');
assert.deepEqual(readings(1, 'twist'), []);
assert.deepEqual(readings(0, 'ml'), []);
assert.equal(readings(25, 'ml', { name: 'Lime juice' }).find((r) => r.unit === 'g')!.label, '26 g');

assert.equal(formatMl(300), '300 ml');
assert.equal(formatMl(1200), '1.2 L');
assert.equal(formatMl(4.25), '4.3 ml');

console.log('calculators: ok');
