// Checks for lib/batch.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildBatch, clampServes, classifyMethod, formatVolume, formatWeight, freezingPointC, isGarnishUnit, leaveOutFor, servesFromStock, servesToFill, stockLines, stockUnit } from './batch';
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

// Weighed specs (Ethyl imports): amounts stay in grams, volume counts toward the bottle.
const grow = (id: string, name: string, amount: number, unit: string, abv: number | null = null) => ({ ...row(id, name, amount, unit), display_ingredient: { id, name, abv } });
const weighedMartini = specLines([grow('gin', 'Gin', 57, 'g', 40), grow('dry', 'Dry vermouth', 15, 'g', 17), grow('syr', 'Sugar syrup', 2.46, 'g')]);
const wm = buildBatch(weighedMartini, ['Stir'], 24);
assert.deepEqual(wm.lines.map((l) => l.amount), ['1.37 kg', '360 g', '59 g'], 'scaled in grams, not as counts');
assert.deepEqual(buildBatch(weighedMartini, ['Stir'], 24, { unit: 'oz' }).lines.map((l) => l.amount), ['1.37 kg', '360 g', '59 g'], 'weights ignore the ml/oz toggle');
assert.ok(Math.abs(wm.lines[0].ml! - 1443) < 1, '1.37 kg of gin is about 1.44 L');
assert.equal(wm.water?.amount, '372 ml', '20% of 1443 + 368 + 48 ml');
assert.equal(wm.total, '2.23 L');
assert.equal(wm.bottles, 3);
const weighedSour = buildBatch(specLines([grow('rum', 'White rum', 28.5, 'g', 40), grow('lime', 'Lime juice', 0.0208, 'kg')]), ['Shake'], 10);
assert.deepEqual(weighedSour.lines.map((l) => [l.amount, l.leaveOut]), [['285 g', null], ['208 g', 'citrus']]);
assert.equal(weighedSour.total, '300.5 ml', 'only the rum goes in the bottle');
assert.equal(formatWeight(4.25), '4.3 g');
assert.equal(formatWeight(32.5 * 30), '975 g');

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

// The bar's decision beats the guess (recipes.at_service): lime in the bottle
// for a pre-diluted bottled daiquiri, and a syrup added at the station.
const decided = specLines([
  { ...row('rum', 'White rum', 60, 'ml'), at_service: false },
  { ...row('lime', 'Lime juice', 22.5, 'ml'), at_service: false },
  { ...row('syr', 'Simple syrup', 15, 'ml'), at_service: true },
]);
const dec = buildBatch(decided, ['Shake'], 10);
assert.deepEqual(dec.lines.map((l) => l.leaveOut), [null, null, 'station']);
assert.equal(dec.total, '825 ml', 'the lime counts once the bar says it goes in');
assert.match(dec.note, /Batch the White rum and Lime juice only\..*Add Simple syrup at the station\./);
assert.equal(leaveOutFor('Lime juice', 'ml', null), 'citrus', 'undecided lines keep the guess');
assert.equal(leaveOutFor('Lime juice', 'ml', true), 'citrus', 'a decided station line keeps the reason its name gives');
assert.equal(leaveOutFor('Simple syrup', 'ml', true), 'station');
assert.equal(leaveOutFor('Lemon', 'twist', false), null);
assert.ok(isGarnishUnit('twist') && !isGarnishUnit('ml'));

// Dilution follows the drink: the venue's figure, and bottled drinks get water too.
const m22 = buildBatch(martini, ['Stir'], 24, { dilutionPct: 22 });
assert.equal(m22.water?.pct, 22);
assert.equal(m22.water?.amount, '400 ml', '22% of 1.82 L');
assert.match(m22.note, /\(22% dilution\)/);
const bottledSour = buildBatch(daiquiri, ['Shake'], 10, { dilutionPct: 25, serviceStyle: 'bottled' });
assert.equal(bottledSour.water?.amount, '187.5 ml', 'a bottled daiquiri is diluted in the bottle');
assert.match(bottledSour.note, /pour straight from the bottle/);
assert.equal(buildBatch(daiquiri, ['Shake'], 10, { dilutionPct: 25 }).water, null, 'shaken to order gets no water');
const freezer = specLines([row('gin', 'Gin', 75, 'ml'), row('w', 'Filtered water', 18, 'ml')]);
assert.equal(buildBatch(freezer, ['Stir'], 10).water, null, 'water already in the spec');
assert.match(buildBatch(freezer, ['Stir'], 10).note, /already in the spec/);
assert.equal(buildBatch(martini, ['Stir'], 24, { dilutionPct: 0 }).water, null);

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

// The Penicillin from the design canvas: 12 serves fill a litre; lemon and the Islay float stay at the station.
const pen = specLines([
  grow('scotch', 'Blended Scotch', 60, 'ml', 40),
  grow('lemon', 'Lemon juice', 22.5, 'ml'),
  grow('hg', 'Honey-ginger syrup', 22.5, 'ml'),
  { ...grow('islay', 'Islay Scotch', 7.5, 'ml', 43), at_service: true },
]);
const pb = buildBatch(pen, ['Shake'], 12, { bottleSize: 1000 });
assert.equal(pb.total, '990 ml');
assert.equal(pb.bottles, 1);
assert.equal(pb.pour, '82.5 ml', 'what each serve takes from the bottle');
assert.deepEqual(pb.lines.filter((l) => l.leaveOut).map((l) => [l.ingredient, l.perServe, l.amount]), [['Lemon juice', '22.5 ml', '270 ml'], ['Islay Scotch', '7.5 ml', '90 ml']]);
assert.equal(Math.round(pb.abv! * 10) / 10, 29.1, '288 ml of ethanol in 990 ml');
assert.equal(servesToFill(pen, ['Shake'], 1000), 12, '82.5 ml a serve: 12 fit in a litre');
assert.equal(servesToFill(pen, ['Shake'], 700), 8);

// A freezer Martini for home: 6 serves fill a 750 ml bottle at 20% water, and it's about 30% ABV.
const fm = specLines([grow('gin', 'London Dry Gin', 75, 'ml', 40), grow('dry', 'Dry vermouth', 15, 'ml', 18)]);
assert.equal(servesToFill(fm, ['Stir'], 750), 6, '108 ml a serve with the water');
const fmb = buildBatch(fm, ['Stir'], 6);
assert.equal(fmb.total, '648 ml');
assert.equal(Math.round(fmb.abv!), 30, 'water counts in the bottle strength');
assert.ok(freezingPointC(fmb.abv!) > -18, 'so it slushes in a -18 C freezer');
assert.equal(freezingPointC(30), -15);
assert.equal(freezingPointC(40), -23);
assert.equal(freezingPointC(35), -19);
assert.equal(freezingPointC(0), 0);
assert.equal(buildBatch(specLines([row('x', 'Mystery', 30, 'ml')]), ['Stir'], 2).abv, null, 'no ABV on file: no strength');

// Start from what's on the shelf: the line in its own kind of unit.
assert.equal(servesFromStock(pen[0], 700, 'ml'), 11, '700 ml of Scotch at 60 a serve');
assert.equal(servesFromStock(pen[0], 23.67, 'oz'), 11);
assert.equal(servesFromStock(pen[0], 0, 'ml'), 1);
const honey = specLines([grow('h', 'Honey', 20, 'g'), row('t', 'Lemon', 1, 'twist')]);
assert.equal(stockUnit(honey[0], 'ml'), 'g');
assert.equal(servesFromStock(honey[0], 450, 'g'), 22);
assert.deepEqual(stockLines(honey).map((l) => l.key), ['h'], 'a twist is not something you run out of by the ml');

console.log('batch: ok');
