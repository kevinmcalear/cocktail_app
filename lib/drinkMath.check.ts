// Checks for lib/drinkMath.ts. Run: npm run test:unit
// The daiquiri and Penicillin figures here are the ones
// supabase/tests/drink-math.test.mjs expects the server to store.
import assert from 'node:assert/strict';

import { convertLine, density, dilutionFor, drinkStrength, formatAbv, formatAmount, isWaterLine, lineAmount, lineDetail, toMl } from './drinkMath';
import { specLines } from './spec';

const near = (a: number | null | undefined, b: number, msg?: string) => assert.ok(a != null && Math.abs(a - b) < 0.06, `${msg ?? ''} expected ${b}, got ${a}`);
const row = (id: string, name: string, amount: number | null, unit: string | null, abv: number | null = null, extra: Record<string, unknown> = {}) => ({
  id,
  amount,
  unit,
  display_ingredient_id: id,
  display_ingredient: { id, name, abv },
  ...extra,
});

// Density: own figure first, then the name, then the ABV.
assert.equal(density('Anything', 40, 0.9), 0.9);
assert.equal(density('Honey', null), 1.42);
assert.equal(density('1:1 sugar syrup', null), 1.23);
assert.equal(density('Lime juice', null), 1.04);
assert.equal(density('Water', null), 1);
near(density('White rum', 40), 0.948);
near(density('Dry vermouth', 17), 0.978);
near(density('Overproof rum', 60), 0.898);
near(toMl(50, 'g', density('White rum', 40)), 52.7, '50 g of rum');
near(toMl(2, 'oz', 1), 59.14);
assert.equal(toMl(1, 'twist', 1), null);

// A daiquiri: 60 ml rum at 40%, 22.5 lime, 15 syrup. Shaken, so 25% water.
const daiquiri = specLines([row('rum', 'White rum', 60, 'ml', 40), row('lime', 'Lime juice', 22.5, 'ml'), row('syr', 'Simple syrup', 15, 'ml', 0)]);
const d = drinkStrength(daiquiri, 'shaken')!;
near(d.totalMl, 97.5);
near(d.ethanolMl, 24);
near(d.abv, 24.6);
assert.equal(d.dilutionPct, 25);
near(d.serveMl, 121.9);
near(d.serveAbv, 19.7);
near(d.unitsUk, 2.4);
assert.equal(d.unknownAbv, 1, 'lime has no ABV on file and counted as 0');
assert.equal(d.lines[0].ethanolMl, 24);

// The Penicillin the server test seeds: 60 Scotch 40, 22.5 lemon, 22.5 syrup, 7.5 Islay 40.
const pen = drinkStrength(specLines([row('a', 'Blended Scotch', 60, 'ml', 40), row('b', 'Lemon juice', 22.5, 'ml'), row('c', 'Honey-ginger syrup', 22.5, 'ml', 0), row('d', 'Islay Scotch', 7.5, 'ml', 40)]), 'shaken')!;
near(pen.abv, 24.0);
near(pen.serveMl, 140.6);
near(pen.serveAbv, 19.2);

// Dilution: the drink's own figure, else water already in the spec, else the venue's default, else the house rule.
assert.equal(dilutionFor('stirred', {}), 20);
assert.equal(dilutionFor('built', { defaults: { stirred: 22 } }), 10);
assert.equal(dilutionFor('stirred', { defaults: { stirred: 22 } }), 22);
assert.equal(dilutionFor('stirred', { dilutionPct: 18, defaults: { stirred: 22 } }), 18);
assert.equal(dilutionFor('stirred', { preDiluted: true, defaults: { stirred: 22 } }), 0);
assert.equal(dilutionFor('stirred', { dilutionPct: 5, preDiluted: true }), 5, 'a measured figure wins even then');
assert.equal(dilutionFor('unknown', {}), 0);

// A freezer martini with water in the spec: no more dilution at service.
const freezer = specLines([row('g', 'Gin', 75, 'ml', 40), row('v', 'Dry vermouth', 15, 'ml', 17), row('w', 'Filtered water', 18, 'ml')]);
assert.ok(isWaterLine(freezer[2]) && !isWaterLine(freezer[0]));
assert.equal(isWaterLine(specLines([row('s', 'Soda water', 60, 'ml')])[0]), false, 'soda is not dilution');
assert.equal(isWaterLine(specLines([row('w', 'Water', 18, 'ml', null, { at_service: true })])[0]), false, 'water added at the station is not in the bottle');
const f = drinkStrength(freezer, 'stirred', { defaults: { stirred: 22 } })!;
assert.equal(f.dilutionPct, 0);
assert.equal(f.preDiluted, true);
near(f.serveMl, 108);
near(f.serveAbv, f.abv);

// Weighed lines convert through density; a masked spec has no strength.
const weighed = drinkStrength(specLines([row('r', 'White rum', 50, 'g', 40), row('l', 'Lime juice', 25, 'g'), row('s', '1:1 sugar syrup', 17.5, 'g', 0)]), 'shaken')!;
near(weighed.lines[0].ml, 52.7);
near(weighed.abv, 23.2);
assert.equal(drinkStrength(specLines([row('r', 'White rum', null, null, 40)]), 'shaken'), null);
assert.equal(drinkStrength(specLines([row('t', 'Lemon', 1, 'twist')]), 'shaken'), null, 'garnish alone is not a drink');

// Formatting and the g · ml · oz switch.
assert.equal(formatAbv(24.63), '24.6%');
assert.equal(formatAbv(null), null);
assert.equal(formatAmount(121.9, 'ml'), '122 ml');
assert.equal(formatAmount(52.66, 'ml'), '52.7 ml');
assert.equal(formatAmount(1250, 'ml'), '1.25 L');
assert.equal(formatAmount(1250, 'g'), '1.25 kg');
assert.equal(formatAmount(60, 'oz'), '2 oz');
assert.equal(formatAmount(22.5, 'oz'), '0.75 oz', 'snaps to the jigger line');
assert.equal(formatAmount(20, 'oz'), '0.68 oz', 'too far from a quarter to snap');
assert.equal(formatAmount(45, 'oz'), '1.5 oz');
const rumG = specLines([row('r', 'White rum', 50, 'g', 40)])[0];
assert.equal(convertLine(rumG, 'g', density('White rum', 40)), null, 'already in grams');
assert.equal(convertLine(rumG, 'ml', density('White rum', 40)), '52.7 ml');
assert.equal(convertLine(rumG, 'oz', density('White rum', 40)), '1.8 oz');

// The switch changes the main amount; dashes and counts stay as written.
const ginOz = specLines([row('g', 'London Dry Gin', 1, 'oz', 42)])[0];
assert.equal(lineAmount(ginOz, 'oz'), '1 oz');
assert.equal(lineAmount(ginOz, 'ml'), '29.6 ml');
assert.equal(lineAmount(ginOz, 'g'), '27.9 g');
const lime = specLines([row('l', 'Lime juice', 22.5, 'ml')])[0];
assert.equal(lineAmount(lime, 'ml'), '22.5 ml');
assert.equal(lineAmount(lime, 'oz'), '0.75 oz');
assert.equal(lineAmount(specLines([row('b', 'Angostura bitters', 2, 'dashes', 44.7)])[0], 'ml'), '2 dashes');
assert.equal(lineAmount(specLines([row('t', 'Lemon', 1, 'twist')])[0], 'oz'), '1 twist');

// The line under the name is the ingredient's own strength.
assert.equal(lineDetail(ginOz), '42% ABV');
assert.equal(lineDetail(rumG), '40% ABV');
assert.equal(lineDetail(lime), null, 'no ABV on file');
assert.equal(lineDetail(specLines([row('s', 'Simple syrup', 15, 'ml', 0)])[0]), null, 'non-alcoholic');

console.log('drinkMath: ok');
