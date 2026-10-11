import assert from 'node:assert/strict';

import {
  amountLabel, amountOf, canSave, choiceList, convertPour, draftFromSpec, COMMON_ICE, creatorProfileId, EMPTY_DRAFT, GARNISH_CHIPS, guessUnit, hasContent, newLine, nextUnit, pickByName,
  likeExactly, QUICK_UNITS, searchByName, stepAmount, sketchLook, specLines, stepFilled, WIZARD_STEPS, type WizardDraft,
  newDraftId, FINISH_CHIPS, FINISH_UNITS, finishLabel, finishStart, STEP_COPY,
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
assert.equal(stepAmount('3', 'drop', 1), '4', 'drops count one at a time');
assert.equal(stepAmount('1', 'drop', -1), '');
assert.equal(stepAmount('', 'spray', 1), '2');
assert.equal(stepAmount('4', 'spray', 1), '5');

// The finish: drops, a mist, a rinse, a float and the garnishes, each a recipe unit.
assert.equal(STEP_COPY.garnish.title, 'How’s it finished?');
assert.equal(STEP_COPY.garnish.short, 'Finish');
for (const u of FINISH_UNITS) assert.ok(RECIPE_UNITS.some((r) => r.value === u), `${u} is a recipe unit`);
for (const c of FINISH_CHIPS) assert.ok((FINISH_UNITS as readonly string[]).includes(c.unit), `${c.label}: ${c.unit} is a finish unit`);
for (const c of FINISH_CHIPS) assert.ok(!!c.name !== !!c.ask, `${c.label} is either a whole line or asks of what`);
// Oils go on in drops, three; saline and tinctures in two; bitters dashed; absinthe rinsed.
assert.deepEqual(finishStart('Mint oil'), { unit: 'drop', amount: '3' });
assert.deepEqual(finishStart('Basil Oil'), { unit: 'drop', amount: '3' });
assert.deepEqual(finishStart('Saline solution'), { unit: 'drop', amount: '2' });
assert.deepEqual(finishStart('Gentian tincture'), { unit: 'drop', amount: '2' });
assert.deepEqual(finishStart('Angostura bitters'), { unit: 'dash', amount: '2' });
assert.deepEqual(finishStart('Absinthe'), { unit: 'rinse', amount: '1' });
assert.deepEqual(finishStart('Edible flower'), { unit: 'each', amount: '1' });
assert.equal(finishLabel({ name: 'Mint oil', amount: '3', unit: 'drop' }), '3 drops Mint oil');
assert.equal(finishLabel({ name: 'Absinthe', amount: '1', unit: 'rinse' }), 'Absinthe rinse');
assert.equal(finishLabel({ name: 'Orange', amount: '1', unit: 'peel' }), 'Orange peel');
assert.equal(finishLabel({ name: 'Coffee beans', amount: '3', unit: 'each' }), '3 Coffee beans');
assert.equal(finishLabel({ name: 'Olive', amount: '1', unit: 'each' }), 'Olive');
assert.equal(finishLabel({ name: 'Mezcal', amount: '', unit: 'spray' }), 'Mezcal, spray');

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

// The glass shape: the pick for this glass, else the bar's glass of this
// type, else the default; a pick for another glass is ignored, as the
// database does after the save.
assert.equal(drawn.variant, null);
assert.equal(draftSketchInputs(sketchLook({ ...negroni, glassVariant: 'rocks_heavy' })).variant, 'rocks_heavy');
assert.equal(draftSketchInputs(sketchLook({ ...negroni, glassVariant: 'martini_pony' })).variant, null);
assert.equal(draftSketchInputs(sketchLook(negroni, ['martini_soft', 'rocks_tapered'])).variant, 'rocks_tapered');
assert.equal(draftSketchInputs(sketchLook({ ...negroni, glassVariant: 'rocks_heavy' }, ['rocks_tapered'])).variant, 'rocks_heavy');

// The kept draft is plain JSON (it lives in storage until the drink is saved).
assert.deepEqual(JSON.parse(JSON.stringify(negroni)), negroni);

// A draft's id is a v4 uuid (the drink's id once saved), new every time.
const ids = new Set(Array.from({ length: 200 }, newDraftId));
assert.equal(ids.size, 200);
for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

console.log('drink wizard: ok');

// --- starting from a classic ---
{
  assert.deepEqual(convertPour(22.5, 'ml', 'oz'), { amount: '0.75', unit: 'oz' });
  assert.deepEqual(convertPour(60, 'ml', 'cl'), { amount: '6', unit: 'cl' });
  assert.deepEqual(convertPour(2, 'dash', 'oz'), { amount: '2', unit: 'dash' });
  assert.deepEqual(convertPour(null, 'top', 'ml'), { amount: '', unit: 'top' });

  const negroni = draftFromSpec(
    {
      id: 'c-negroni',
      name: 'Negroni',
      recipes: [
        { amount: 30, unit: 'ml', ingredient: { id: 'gin', name: 'Gin' } },
        { amount: 30, unit: 'ml', ingredient: { id: 'campari', name: 'Campari' } },
        { amount: 1, unit: 'peel', ingredient: { id: 'orange', name: 'Orange' } },
        { amount: 1, unit: 'rinse', ingredient: { id: 'absinthe', name: 'Absinthe' } },
        { amount: null, unit: null, ingredient: null },
      ],
      item_methods: [{ method_item_id: 'm-stir', sort_order: 1, method: { name: 'Stir' } }, { method_item_id: 'm-build', sort_order: 0, method: { name: 'Build' } }],
      glassware: { id: 'g-rocks', name: 'Rocks' },
      ice: null,
    },
    'oz'
  );
  assert.deepEqual(negroni.lines?.map((l) => [l.name, l.amount, l.unit]), [['Gin', '1', 'oz'], ['Campari', '1', 'oz']]);
  assert.deepEqual(negroni.garnishes?.map((l) => [l.name, l.amount, l.unit]), [['Orange', '1', 'peel'], ['Absinthe', '1', 'rinse']], 'a rinse is part of the finish');
  assert.deepEqual(negroni.methods?.map((m) => m.name), ['Build', 'Stir'], 'methods in their order');
  assert.deepEqual(negroni.riffOf, { id: 'c-negroni', name: 'Negroni' });
  assert.equal(negroni.ice, null);
}

// Amounts read as typed, even before the field tidies them on blur.
assert.equal(amountOf('3/4'), 0.75);
assert.equal(amountOf('22,5'), 22.5);
assert.equal(amountOf('1½'), 1.5);
assert.equal(amountOf(''), null);
assert.equal(amountLabel({ amount: '22,5', unit: 'ml' }), '22.5 ml', 'labels read tidied');
assert.deepEqual(convertPour(0.75, 'ml', 'oz'), { amount: '0.03', unit: 'oz' }, 'a tiny amount is not snapped up to a pour');
assert.deepEqual(convertPour(22, 'ml', 'oz'), { amount: '0.75', unit: 'oz' });
