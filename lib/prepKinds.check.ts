// Checks for lib/prepKinds.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { flavourWords, guessKind, leadText, partsText, PREP_KINDS, prepAmounts, prepFromTechnique, prepYield, startPrep } from './prepKinds';

// The name says the kind.
assert.equal(guessKind('Pineapple chili shrub'), 'shrub');
assert.equal(guessKind('Lime cordial'), 'cordial');
assert.equal(guessKind('Rich demerara syrup'), 'rich');
assert.equal(guessKind('Honey syrup'), 'syrup');
assert.equal(guessKind('Lemon oleo saccharum'), 'oleo');
assert.equal(guessKind('Lime super juice'), 'super');
assert.equal(guessKind('Chamomile infused gin'), 'infusion');
assert.equal(guessKind('Clarified grapefruit'), null);
assert.deepEqual(flavourWords('Pineapple chili shrub'), ['Pineapple', 'Chili']);
assert.deepEqual(flavourWords('Rich simple syrup'), []);

// A cold shrub: the fruit is the base, equal parts, the extra flavour waits for an amount.
const shrub = startPrep('shrub', 'Pineapple chili shrub');
assert.deepEqual(shrub.lines.map((l) => l.name), ['Pineapple', 'Sugar', 'Apple cider vinegar', 'Chili']);
assert.equal(shrub.baseKey, shrub.lines[0].key);
assert.deepEqual(prepAmounts(shrub).map((a) => a.amount), [300, 300, 300, null]);
assert.equal(prepYield(shrub), 670, '300 g fruit gives about 180 ml juice, plus the sugar and vinegar');
assert.equal(shrub.steps.length, 5);
assert.equal(shrub.steps[1].timer_seconds, 86400, 'the day in the fridge is a timer');
assert.equal(leadText(shrub.leadMinutes), 'Start 3 days ahead');
assert.equal(shrub.keepsHours, 4 * 7 * 24);

// The base can move; everything follows.
assert.deepEqual(prepAmounts({ ...shrub, baseAmount: 450 }).map((a) => a.amount), [450, 450, 450, null]);
// A typed amount on a line with no parts counts.
const withChili = { ...shrub, lines: shrub.lines.map((l) => (l.name === 'Chili' ? { ...l, amount: '2' } : l)) };
assert.equal(prepAmounts(withChili)[3].amount, 2);

// A hot shrub is quicker.
assert.equal(leadText(startPrep('shrub', 'Plum shrub', true).leadMinutes), 'Start an hour ahead');

// Rich syrup comes out near the real batch (1130 ml from 1 kg sugar, 500 ml water).
const rich = startPrep('rich', 'Rich syrup');
assert.deepEqual(prepAmounts(rich).map((a) => a.amount), [1000, 500]);
assert.equal(prepYield(rich), 1120);

// A cordial's acid is a percentage of the juice.
const cordial = startPrep('cordial', 'Lime cordial');
assert.equal(cordial.lines[0].name, 'Lime juice');
assert.deepEqual(prepAmounts(cordial).map((a) => a.amount), [500, 500, 10]);
assert.equal(partsText(0.02, 1), '2% of the base');
assert.equal(partsText(1, 1), '1 part');
assert.equal(partsText(2, 1), '2 parts');

// Super juice per gram of peel.
assert.deepEqual(prepAmounts(startPrep('super', 'Lime super juice')).map((a) => a.amount), [60, 39.6, 19.8, 1000.2]);

// Every kind starts with at least one line, and blank keeps no method.
for (const k of PREP_KINDS) assert.ok(startPrep(k.id, 'Test').lines.length >= 1, k.id);
assert.deepEqual(startPrep('other', 'Smoked salt').steps, []);
assert.equal(leadText(null), null);
assert.equal(leadText(15), 'Takes 15 min');

// The draft is plain JSON (it's stored with the drink's draft).
assert.deepEqual(JSON.parse(JSON.stringify(shrub)), shrub);

// From a library technique: its base and parts are the recipe.
const fromAgar = prepFromTechnique(
  { id: 'agar-quick', base: { name: 'Juice', unit: 'g', amounts: [250, 400, 1000] }, parts: [{ name: 'Agar', per: 0.002, unit: 'g' }, { name: 'Water', per: 0.25, unit: 'ml' }] },
  'Clarified grapefruit',
  { steps: [{ body: 'For 400 g juice: 0.8 g agar, 100 ml water.', timer_seconds: null }, { body: 'Boil the agar in the water.', timer_seconds: 60 }], leadMinutes: 45, actions: ['Clarify'] },
);
assert.deepEqual(prepAmounts(fromAgar).map((a) => a.amount), [400, 0.8, 100]);
assert.deepEqual(fromAgar.steps.map((s) => s.body), ['Boil the agar in the water.'], 'the "For 400 g" line is the recipe now');
assert.equal(fromAgar.technique, 'agar-quick');
assert.equal(prepFromTechnique({ id: 'smoke' }, 'Smoked salt', { steps: [{ body: 'Smoke it.', timer_seconds: null }], leadMinutes: 10, actions: ['Infuse'] }).steps.length, 1);
console.log('prepKinds technique checks passed');
