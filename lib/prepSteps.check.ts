// Checks for the house-made page's recipe: lib/prepSteps.ts, batchSizes
// (lib/prepParts.ts) and onHandLine (lib/stock.ts). Run: npm run test:unit
import assert from 'node:assert/strict';

import { batchSizes } from './prepParts';
import { prepStepGroups, stepName } from './prepSteps';
import { onHandLine } from './stock';

// A step is named by its first word.
assert.equal(stepName('Warm the honey and water, low, never boil.'), 'Warm');
assert.equal(stepName('Make a rich syrup: stir the sugar in.'), 'Make');
assert.equal(stepName('  cold-press the ginger'), 'Cold-press');
assert.equal(stepName(''), null);

// The board's Honey-ginger syrup: each line in the first step that names it, in the order it's named.
const lines = [{ name: 'Water' }, { name: 'Honey' }, { name: 'Ginger juice' }];
const groups = prepStepGroups(lines, [
  { body: 'Juice the ginger the day you make it, then strain: ginger juice.', timer_seconds: null },
  { body: 'Warm the honey and water low, never boil, until the honey melts in.', timer_seconds: 600 },
  { body: 'Stir the ginger juice in off the heat, cool, bottle and label.', timer_seconds: null },
]);
assert.deepEqual(
  groups.map((g) => [g.number, g.title, g.aside, g.lines.map((l) => l.name)]),
  [
    ['1', 'Juice', null, ['Ginger juice']],
    ['2', 'Warm', '10 min', ['Honey', 'Water']],
    ['3', 'Stir', null, []],
  ],
);
assert.equal(groups[1].note, 'Warm the honey and water low, never boil, until the honey melts in.');

// Lines no step names lead, unnumbered; with no steps, one group of every line.
const lead = prepStepGroups([{ name: 'Sugar' }, { name: 'Lemon peel' }], [{ body: 'Rub the peels with the sugar and leave overnight.', timer_seconds: null }]);
assert.deepEqual(lead.map((g) => [g.number, g.lines.map((l) => l.name)]), [['1', ['Lemon peel', 'Sugar']]], 'peels names Lemon peel by its last word, before the sugar');
const loose = prepStepGroups([{ name: 'Salt' }, { name: 'Water' }], [{ body: 'Stir until dissolved.', timer_seconds: null }]);
assert.deepEqual(loose.map((g) => [g.number, g.lines.length]), [[null, 2], ['1', 0]]);
assert.deepEqual(prepStepGroups([{ name: 'Salt' }], []).map((g) => [g.number, g.title, g.lines.length]), [[null, null, 1]]);
assert.deepEqual(prepStepGroups([], []), []);

// Two lines ending in the same word go by their whole name: "Juice the lemons" doesn't file Lime juice.
const citrus = prepStepGroups([{ name: 'Lemon juice' }, { name: 'Lime juice' }], [
  { body: 'Juice the lemons.', timer_seconds: null },
  { body: 'Stir the lemon juice and lime juice together.', timer_seconds: null },
]);
assert.deepEqual(citrus.map((g) => [g.number, g.lines.map((l) => l.name)]), [['1', []], ['2', ['Lemon juice', 'Lime juice']]]);

// Makes: a litre batch, half a litre, a 750 bottle; what Log batch writes.
assert.deepEqual(
  batchSizes(1, 'L').map((s) => [s.makes, s.amount, s.unit]),
  [['500 ml', 500, 'ml'], ['750 ml', 750, 'ml'], ['1 L', 1000, 'ml']],
);
assert.deepEqual(
  batchSizes(400, 'g').map((s) => [s.makes, s.amount, s.unit]),
  [['200 g', 200, 'g'], ['400 g', 400, 'g'], ['800 g', 800, 'g']],
);
// No yield: logged as batches, so the day is still kept.
assert.deepEqual(
  batchSizes(null, null).map((s) => [s.makes, s.amount, s.unit]),
  [['½ batch', 0.5, 'batch'], ['1 batch', 1, 'batch'], ['2 batches', 2, 'batch']],
);

// On hand, then the day it was made.
// Local noon, so the day is 30 Oct in every time zone.
const made = { madeAt: new Date(2026, 9, 30, 12).toISOString() };
assert.equal(onHandLine(made, { kind: 'ml', value: 800, unit: 'ml' }), '800 ml · made 30 Oct');
assert.equal(onHandLine(made, { kind: 'ml', value: 0, unit: 'ml' }), 'None · made 30 Oct');
assert.equal(onHandLine(undefined, { kind: 'count', value: 2, unit: 'batch' }), '2 batches');
assert.equal(onHandLine(made, { kind: 'count', value: 0.5, unit: 'batch' }), '½ batch · made 30 Oct');
assert.equal(onHandLine(made, { kind: 'count', value: 1, unit: 'batch' }), '1 batch · made 30 Oct');
assert.equal(onHandLine(made, undefined), 'Made 30 Oct');
assert.equal(onHandLine(undefined, undefined), null);

console.log('prepSteps checks passed');
