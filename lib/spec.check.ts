// Checks for lib/spec.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { gramsPerMl, ratio, specAccess, specLines } from './spec';

const rows = [
  { id: 'b', sort_order: 2, amount: 22.5, unit: 'ml', display_ingredient_id: 'lemon', display_ingredient: { id: 'lemon', name: 'Lemon juice' } },
  { id: 'a', sort_order: 1, amount: 60, unit: 'ml', display_ingredient_id: 'scotch', display_ingredient: { id: 'scotch', name: 'Blended Scotch' }, preparation_notes: ' ' },
  // The server masked the brand down to the generic ingredient.
  { id: 'c', sort_order: 3, amount: 0.25, unit: 'oz', display_ingredient_id: 'peat', display_ingredient: { id: 'peat', name: 'Islay Scotch' } },
  // Fully masked row: no name, no amount. A stray embed must not leak through.
  { id: 'd', sort_order: 4, amount: null, unit: null, display_ingredient_id: null, display_ingredient: { id: 'secret', name: 'Secret syrup' } },
];

const lines = specLines(rows);
assert.deepEqual(lines.map((l) => l.key), ['a', 'b', 'c', 'd'], 'sorted by sort_order');
assert.equal(lines[0].amount, '60 ml');
assert.equal(lines[0].note, null, 'blank prep notes are dropped');
assert.equal(lines[2].ingredient, 'Islay Scotch', 'shows the generic name when the brand is masked');
assert.equal(lines[3].ingredient, null, 'nothing shows when display_ingredient_id is masked');
assert.equal(lines[3].amount, null);

const r = ratio(lines);
assert.ok(r && r.length === 3, 'ratio uses the three measured lines');
assert.ok(Math.abs(r.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
assert.equal(ratio(lines.slice(3)), null, 'no ratio from fewer than two measured lines');

// Weighed specs (Ethyl imports): grams convert to ml by a rough density.
assert.ok(Math.abs(gramsPerMl('London dry gin', 43) - 0.9405) < 1e-9, 'a spirit by its ABV');
assert.equal(gramsPerMl('Simple syrup', null), 1.23);
assert.equal(gramsPerMl('Lime juice', null), 1.04);
assert.ok(Math.abs(gramsPerMl('Dry vermouth', 17) - 0.9779) < 1e-9);
const ing = (id: string, name: string, abv: number | null = null) => ({ display_ingredient_id: id, display_ingredient: { id, name, abv } });
const weighed = specLines([
  { id: 'g', sort_order: 1, amount: 57, unit: 'g', ...ing('gin', 'Gin', 40) },
  { id: 's', sort_order: 2, amount: '24.6', unit: 'g', ...ing('syr', 'Sugar syrup') },
  { id: 'l', sort_order: 3, amount: 0.0208, unit: 'kg', ...ing('lime', 'Lime juice') },
]);
assert.equal(weighed[0].amount, '57 g');
assert.equal(weighed[0].abv, 40, 'the ABV rides along for the ethanol maths');
assert.ok(Math.abs(weighed[0].ml! - 60.1) < 0.1, '57 g of gin is about 60 ml');
assert.ok(Math.abs(weighed[1].ml! - 20) < 1e-9, '24.6 g of syrup is 20 ml');
assert.ok(Math.abs(weighed[2].ml! - 20) < 1e-9, '0.0208 kg of lime is 20 ml');
assert.deepEqual(ratio(weighed)?.map((x) => Math.round(x.share * 100)), [60, 20, 20], 'every weighed line is on the ratio bar');

const levels = { generic: 20, brand: 30, measurement: 30, prep: 40 };
assert.deepEqual(specAccess(10, levels, true), { names: false, amounts: false, prep: false });
assert.deepEqual(specAccess(30, levels, true), { names: true, amounts: true, prep: false });
assert.deepEqual(specAccess(10, levels, false), { names: true, amounts: true, prep: true }, 'personal drinks show everything');

console.log('spec: ok');
