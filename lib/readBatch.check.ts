import assert from 'node:assert/strict';

import { batchPrep } from './batchLines';
import { openPickLine, readBatchLine, recipeDraft, startChoices } from './bringInDraft';
import type { CatalogItem } from './match';
import { batchAt, bottleMl, drinkRecipe, keepSeparate, perDrinkLines } from './readBatch';
import { cleanRecipes } from '../supabase/functions/_shared/anythingRead';

// A batch read from a spec sheet (Fix 10) saves as the batch fix 9 makes by hand.

const item = (id: string, name: string): CatalogItem => ({ id, name, genericId: null, barId: null });
const data = { catalog: [item('mez', 'Mezcal'), item('cyn', 'Cynar'), item('pg', 'Pink grapefruit juice')], aliases: [], venueId: null };
const lists = { methods: [], glasses: [], ice: [] };
const [recipe, older] = cleanRecipes([
  {
    name: 'Smoke Signal',
    lines: [
      { amount: 30, unit: 'ml', ingredient: 'Pink grapefruit juice' },
      { amount: 60, unit: 'ml', ingredient: 'Batch', batch: true },
      { amount: 5, unit: 'ml', ingredient: 'Agave syrup' },
    ],
    batch: { name: 'Smoke Signal batch', heading: 'Batch recipe (750 ml)', lines: [{ amount: 450, unit: 'ml', ingredient: 'Mezcal' }, { amount: 300, unit: 'ml', ingredient: 'Cynar' }] },
  },
  { name: 'Negroni', lines: [{ amount: 30, unit: 'ml', ingredient: 'Gin' }] },
]);

assert.equal(batchAt(recipe), 1);
assert.equal(bottleMl(recipe.batch!), 750);
// One drink's share of the bottle: 60 ml of 750 is 36 ml mezcal and 24 ml Cynar.
assert.deepEqual(perDrinkLines(recipe).map((l) => [l.ingredient, l.amount, l.unit]), [['Mezcal', 36, 'ml'], ['Cynar', 24, 'ml']]);

// The drink gets one line, "60 ml Smoke Signal batch", and the bottle saves as a Batch prep with the file's amounts.
const choices = startChoices(recipe);
const draft = recipeDraft(recipe, choices, data, lists, 'ml');
assert.deepEqual(draft.lines.map((l) => [l.name, l.amount, l.unit]), [['Pink grapefruit juice', '30', 'ml'], ['Smoke Signal batch', '60', 'ml'], ['Agave syrup', '5', 'ml']]);
const line = draft.lines[1];
assert.equal(line.batch?.bottleMl, 750);
assert.deepEqual(line.batch?.lines.map((l) => [l.id, l.name, l.amount]), [['mez', 'Mezcal', '36'], ['cyn', 'Cynar', '24']]);
const prep = batchPrep(line.batch!);
assert.deepEqual(prep.actions, ['Batch']);
assert.equal(Math.round(prep.baseAmount), 450);
// A bigger bottle picked in the sheet: the drink still pours 60 ml.
const litre = readBatchLine(recipe, { batch: { bottleMl: 1000 } }, data)!;
assert.equal(litre.batch?.bottleMl, 1000);
assert.equal(litre.amount, '60');
// Saved already by an earlier drink: the line is that house prep, nothing new to make.
const made = recipeDraft(recipe, choices, data, lists, 'ml', { [recipe.batch!.key]: 'prep-1' }).lines[1];
assert.deepEqual([made.id, made.name, made.amount, made.unit, made.batch], ['prep-1', 'Smoke Signal batch', '60', 'ml', undefined]);

// Keep as separate lines: the bottle's lines in its place, one drink's worth; other lines keep their picks.
const picked = { ...choices, lines: { 0: { fresh: true as const }, 2: { pick: 'x' } } };
const apart = keepSeparate(recipe, picked, true);
assert.deepEqual(apart.lines, { 0: { fresh: true }, 3: { pick: 'x' } });
assert.deepEqual(drinkRecipe(recipe, apart).lines.map((l) => [l.ingredient, l.amount]), [['Pink grapefruit juice', 30], ['Mezcal', 36], ['Cynar', 24], ['Agave syrup', 5]]);
assert.equal(drinkRecipe(recipe, apart).batch, null);
assert.ok(recipeDraft(recipe, apart, data, lists, 'ml').lines.every((l) => !l.batch));
// And back: the picks return to their lines.
assert.deepEqual(keepSeparate(recipe, apart, false).lines, picked.lines);
// Its open picks count the lines a drink shows, never the batch line itself.
assert.equal(openPickLine(recipe, choices, data), null);

// A reading from before batches: nothing changes.
assert.equal(batchAt(older), -1);
assert.equal(drinkRecipe(older, startChoices(older)), older);
assert.equal(readBatchLine(older, {}, data), null);
assert.equal(keepSeparate(older, startChoices(older), true).batch, undefined);

console.log('readBatch: ok');
