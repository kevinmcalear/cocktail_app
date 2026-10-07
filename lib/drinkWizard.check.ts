import assert from 'node:assert/strict';

import {
  canSave, choiceList, COMMON_ICE, creatorProfileId, EMPTY_DRAFT, GARNISH_CHIPS, guessUnit, hasContent, newLine, nextUnit, pickByName,
  likeExactly, QUICK_UNITS, searchByName, stepAmount, sketchLook, specLines, stepFilled, WIZARD_STEPS, type WizardDraft,
} from './drinkWizard';
import { draftSketchInputs } from './sketch/draft';
import { RECIPE_UNITS } from './units';

const rows = [
  { id: 'i1', name: 'Large Cube' },
  { id: 'i2', name: 'Cubes' },
  { id: 'i3', name: 'Shaved' },
  { id: 'i4', name: null },
];

// Common choices reuse existing rows (any case), new ones are made on save, then the rest A to Z.
const ice = choiceList(COMMON_ICE, rows);
assert.deepEqual(ice.slice(0, 4), [
  { id: null, name: 'No ice' },
  { id: 'i2', name: 'Cubes' },
  { id: 'i1', name: 'Large Cube' },
  { id: null, name: 'Crushed' },
]);
assert.equal(ice.at(-1)?.name, 'Shaved', 'other rows follow the common ones');
assert.equal(new Set(ice.map((p) => p.name.toLowerCase())).size, ice.length, 'no duplicates');
assert.deepEqual(pickByName(' large cube ', rows), { id: 'i1', name: 'Large Cube' });

// A typed name is looked up as itself: no wildcards, spaces tidied.
assert.equal(likeExactly('  Freezer   pour '), 'Freezer pour');
assert.equal(likeExactly('50%_off'), '50\\%\\_off');

// Search: names that start with it first, shortest first.
const ingredients = [{ id: 'a', name: 'Sloe Gin' }, { id: 'b', name: 'Gin' }, { id: 'c', name: 'Ginger syrup' }, { id: 'd', name: 'Lime' }];
assert.deepEqual(searchByName('gin', ingredients).map((r) => r.id), ['b', 'c', 'a']);
assert.deepEqual(searchByName('  ', ingredients), []);

// Units: bitters in dashes, soda topped, eggs counted, otherwise your usual.
assert.equal(guessUnit('Angostura Bitters', 'ml'), 'dash');
assert.equal(guessUnit('Soda water', 'oz'), 'top');
assert.equal(guessUnit('Ginger beer syrup', 'oz'), 'oz');
assert.equal(guessUnit('Egg white', 'ml'), 'each');
assert.equal(guessUnit('Gin', 'oz'), 'oz');
for (const u of QUICK_UNITS) assert.ok(RECIPE_UNITS.some((r) => r.value === u), `${u} is a recipe unit`);
assert.equal(nextUnit(QUICK_UNITS.at(-1)!), QUICK_UNITS[0], 'the unit cycles round');
assert.equal(nextUnit('splash'), 'ml', 'an odd unit cycles from the start');
for (const c of GARNISH_CHIPS) assert.ok(RECIPE_UNITS.some((r) => r.value === c.unit), `${c.label}: ${c.unit} is a recipe unit`);

// The stepper walks the bar's measures, and clears below the smallest.
assert.equal(stepAmount('', 'ml', 1), '30');
assert.equal(stepAmount('30', 'ml', 1), '35');
assert.equal(stepAmount('22', 'ml', -1), '20');
assert.equal(stepAmount('0.75', 'oz', 1), '1');
assert.equal(stepAmount('5', 'ml', -1), '', 'below the smallest is unmeasured');
assert.equal(stepAmount('120', 'ml', 1), '150', 'past the ladder it keeps the last step');
assert.equal(stepAmount('2', 'dash', 1), '3');
assert.equal(stepAmount('', 'each', -1), '');

// Only the name is required; empty optional steps can be skipped.
assert.equal(canSave(EMPTY_DRAFT), false);
assert.equal(hasContent(EMPTY_DRAFT), false);
const named: WizardDraft = { ...EMPTY_DRAFT, name: 'Quiet Storm' };
assert.ok(canSave(named) && hasContent(named));
for (const s of WIZARD_STEPS) if (s !== 'name' && s !== 'review') assert.equal(stepFilled(s, named), false, s);

// Credit: you by default (when you have a profile), unless you chose someone else or nobody.
assert.equal(creatorProfileId(named, 'me-1'), 'me-1');
assert.equal(creatorProfileId(named, null), null);
assert.equal(creatorProfileId({ ...named, creator: 'nobody' }, 'me-1'), null);
assert.equal(creatorProfileId({ ...named, creator: { id: 'p-9', name: 'Sam' } }, 'me-1'), 'p-9');

assert.ok(stepFilled('credits', { ...named, coCreators: [{ id: 'p-2', name: 'Ali' }] }), 'naming who else made it fills the step');

// The spec saves ingredients then garnishes, and the sketch sees both.
const negroni: WizardDraft = {
  ...named,
  name: 'Negroni',
  lines: [newLine({ id: 'g', name: 'Gin' }, 'ml', '30'), newLine({ id: 'c', name: 'Campari' }, 'ml', '30'), newLine({ id: 'v', name: 'Sweet vermouth' }, 'ml', '30')],
  methods: [{ id: null, name: 'Stir' }],
  glass: { id: null, name: 'Rocks' },
  ice: { id: null, name: 'Large cube' },
  garnishes: [newLine({ id: null, name: 'Orange' }, 'peel', '1')],
};
assert.equal(new Set([...negroni.lines, ...negroni.garnishes].map((l) => l.key)).size, 4, 'line keys are unique');
assert.deepEqual(specLines(negroni).map((l) => [l.line.name, l.amount, l.line.unit]), [
  ['Gin', 30, 'ml'], ['Campari', 30, 'ml'], ['Sweet vermouth', 30, 'ml'], ['Orange', 1, 'peel'],
]);
const drawn = draftSketchInputs(sketchLook(negroni));
assert.equal(drawn.glass, 'rocks');
assert.equal(drawn.ice, 'large');
assert.equal(drawn.garnish, 'orange_peel');
assert.equal(drawn.from.glass, 'data');

// The kept draft is plain JSON (it lives in storage until the drink is saved).
assert.deepEqual(JSON.parse(JSON.stringify(negroni)), negroni);

console.log('drink wizard: ok');
