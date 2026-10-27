// Checks for lib/glassFill.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { barMeasure, factorWords, fillWords, fittedCostMinor, fitToWashLine, glassFill, washLine, type Fill, type FillLine, type Fitted } from './glassFill';

// The wash line: the venue's own, else 90% of the brim to the nearest 5 ml (its typed capacity before its real glass's).
assert.deepEqual(washLine({ wash_line_ml: 150, capacity_ml: null, model: { capacity_ml: 170 } }), { ml: 150, said: true, brimMl: 170 });
assert.deepEqual(washLine({ wash_line_ml: null, capacity_ml: null, model: { capacity_ml: 170 } }), { ml: 155, said: false, brimMl: 170 });
assert.equal(washLine({ wash_line_ml: null, capacity_ml: 200, model: { capacity_ml: 170 } })?.ml, 180);
assert.equal(washLine({ wash_line_ml: null, capacity_ml: null, model: null }), null);

// The board's Smoke Signal in Little Rye's Nick and Nora: 45 + 22.5 + 17.5 + 10 = 95 ml, shaken (25%) is 118.75 ml.
const smoke: FillLine[] = [
  { amount: '45', unit: 'ml', ingredient: 'Mezcal' },
  { amount: '22.5', unit: 'ml', ingredient: 'Amaro Montenegro' },
  { amount: '17.5', unit: 'ml', ingredient: 'Lime juice' },
  { amount: '10', unit: 'ml', ingredient: 'Honey syrup' },
];
const up = { method: 'shaken' as const, washLineMl: 150, iceG: 0 };
const short = glassFill(smoke, up) as Fill;
assert.equal(short.state, 'short');
assert.equal(short.serveMl, 118.75);
assert.equal(Math.round(short.diffMl), -31);
assert.equal(fillWords(short), '31 ml short of the 150 ml wash line');

// The venue's own dilution counts, and a measured one wins.
assert.equal((glassFill(smoke, { ...up, defaults: { shaken: 30 } }) as Fill).dilutionPct, 30);
assert.equal((glassFill(smoke, { ...up, defaults: { shaken: 30 }, dilutionPct: 18 }) as Fill).dilutionPct, 18);
// Within 5 ml (or 4%) of the line it fits; past it, it's over.
assert.equal((glassFill(smoke, { ...up, washLineMl: 120 }) as Fill).state, 'fits');
const over = glassFill(smoke, { ...up, washLineMl: 100 }) as Fill;
assert.equal(over.state, 'over');
assert.equal(fillWords(over), '19 ml over the 100 ml wash line');

// Nothing to say: a top fills it to the line, an unknown method, ice nobody weighed, no amounts.
assert.equal(glassFill([...smoke, { amount: null, unit: 'top', ingredient: 'Soda' }], up), 'top');
assert.equal(glassFill(smoke, { ...up, method: 'unknown' }), 'method');
assert.notEqual(glassFill(smoke, { ...up, method: 'unknown', dilutionPct: 20 }), 'method', 'a measured dilution does without the method');
assert.equal(glassFill(smoke, { ...up, iceG: null }), 'ice');
assert.equal(glassFill([{ amount: null, unit: 'ml', ingredient: 'Gin' }], up), 'empty');

// Ice in the glass takes room: 92 g of ice is 100 ml, so a 150 ml line leaves 50 for the drink.
const onIce = glassFill([{ amount: '45', unit: 'ml', ingredient: 'Gin' }], { method: 'built', washLineMl: 150, iceG: 92 }) as Fill;
assert.equal(Math.round(onIce.levelMl), 150, '45 ml built (10%) is 49.5, plus 100 ml of ice');
// Water in the spec means it's already diluted.
assert.equal((glassFill([...smoke, { amount: '15', unit: 'ml', ingredient: 'Water' }], up) as Fill).dilutionPct, 0);

// Bar measures, in the line's own unit, never down to nothing.
assert.equal(barMeasure(56.25, 'ml'), 57.5);
assert.equal(barMeasure(28.1, 'ml'), 27.5);
assert.equal(barMeasure(7.3, 'ml'), 7.5);
assert.equal(barMeasure(0.1, 'ml'), 0.5);
assert.equal(barMeasure(1.9, 'oz'), 2);
assert.equal(barMeasure(0.8, 'oz'), 0.75);
assert.equal(barMeasure(0.3, 'oz'), 0.25);
assert.equal(barMeasure(0.4, 'oz'), 0.375);
assert.equal(barMeasure(5.6, 'cl'), 5.5);
assert.equal(barMeasure(12.4, 'g'), 12);

// Fit it scales every measured line by one factor, so the ratio stays the bar's, and lands within the line.
const fit = fitToWashLine(smoke, up)!;
assert.ok(Math.abs(fit.factor - 150 / 1.25 / 95) < 1e-9);
assert.deepEqual(
  fit.lines.map((l) => l.amount),
  ['57.5', '27.5', '22.5', '12.5']
);
assert.ok(fit.lines.every((l) => l.changed));
assert.equal(fit.fill.state, 'fits');
assert.ok(Math.abs(fit.fill.diffMl) <= 5);
assert.equal(factorWords(fit.factor), 'Every amount up by 26%.');

// Over the line it scales down; dashes stay as written but still count; ounces stay ounces.
const manhattan: FillLine[] = [
  { amount: '2.5', unit: 'oz', ingredient: 'Rye' },
  { amount: '1.25', unit: 'oz', ingredient: 'Sweet vermouth' },
  { amount: '2', unit: 'dash', ingredient: 'Angostura bitters' },
];
const down = fitToWashLine(manhattan, { method: 'stirred', washLineMl: 120, iceG: 0 })!;
assert.ok(down.factor < 1);
assert.deepEqual(
  down.lines.map((l) => [l.amount, l.unit, l.changed]),
  [
    ['2.25', 'oz', true],
    ['1', 'oz', true],
    ['2', 'dash', false],
  ]
);
assert.equal(down.fill.state, 'fits');
assert.equal(factorWords(down.factor), 'Every amount down by 11%.');

// Nothing that scales, or nothing to fit: null.
assert.equal(fitToWashLine([{ amount: '3', unit: 'dash', ingredient: 'Bitters' }], up), null);
assert.equal(fitToWashLine(smoke, { ...up, iceG: null }), null);
// Past doubling or halving it says so but offers no fit: the glass or the spec is more likely wrong.
assert.equal(fitToWashLine([{ amount: '30', unit: 'ml', ingredient: 'Rye' }], { method: 'built', washLineMl: 300, iceG: 0 }), null);
assert.equal((glassFill([{ amount: '30', unit: 'ml', ingredient: 'Rye' }], { method: 'built', washLineMl: 300, iceG: 0 }) as Fill).state, 'short');
assert.equal(fitToWashLine(smoke, { ...up, washLineMl: 50 }), null);

// The fitted cost: each changed line's cost scales with its amount; a line with no price, or lines that don't line up, say nothing.
const fittedUp: Fitted = { factor: 1.2, fill: { serveMl: 0, levelMl: 0, washLineMl: 0, diffMl: 0, state: 'fits', dilutionPct: 0 }, lines: [{ amount: '60', unit: 'ml', changed: true }, { amount: '2', unit: 'dash', changed: false }] };
const costed = { total_minor: 400, missing: 0, lines: [{ ingredient: 'Rye', minor: 300 }, { ingredient: 'Bitters', minor: 20 }] };
assert.equal(fittedCostMinor(costed, ['Rye', 'Bitters'], ['50', '2'], fittedUp), 460);
assert.equal(fittedCostMinor({ ...costed, missing: 1 }, ['Rye', 'Bitters'], ['50', '2'], fittedUp), null);
assert.equal(fittedCostMinor(costed, ['Gin', 'Bitters'], ['50', '2'], fittedUp), null);
assert.equal(fittedCostMinor({ ...costed, lines: [costed.lines[0]] }, ['Rye', 'Bitters'], ['50', '2'], fittedUp), null);
// The same ingredient twice (made in parts): each line scales its own cost.
const twice: Fitted = { ...fittedUp, lines: [{ amount: '60', unit: 'ml', changed: true }, { amount: '20', unit: 'ml', changed: true }] };
assert.equal(fittedCostMinor({ total_minor: 400, missing: 0, lines: [{ ingredient: 'Rye', minor: 300 }, { ingredient: 'Rye', minor: 100 }] }, ['Rye', 'Rye'], ['50', '10'], twice), 560);

console.log('glassFill checks passed');
