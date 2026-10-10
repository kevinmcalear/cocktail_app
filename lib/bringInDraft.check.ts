import assert from 'node:assert/strict';

import { openPickLine, prepFromRatio, recipeDraft, startChoices } from './bringInDraft';
import type { CatalogItem } from './match';

// A recipe read by Bring in saves through the add-drink wizard's own save.

const item = (id: string, name: string, genericId: string | null = null): CatalogItem => ({ id, name, genericId, barId: null });
const catalog = [item('calv', 'Calvados'), item('pear', 'Pear liqueur'), item('rw', 'Rothman & Winter Pear Liqueur', 'pear'), item('bb', 'Belle de Brillet Pear Liqueur', 'pear'), item('soda', 'Soda Water'), item('honey', 'Honey')];
const data = { catalog, aliases: [], venueId: null };
const recipe = {
  name: 'Orchard Fizz',
  by: 'Little Rye',
  lines: [
    { amount: 1.5, unit: 'oz', ingredient: 'Calvados', unsure: false },
    { amount: 0.5, unit: 'oz', ingredient: 'Pear', unsure: false },
    { amount: 0.5, unit: 'oz', ingredient: 'Honey Syrup 2:1', unsure: false },
    { amount: null, unit: 'top', ingredient: 'Soda Water', unsure: false },
  ],
  method: 'Shaken',
  glass: 'Collins',
  ice: 'Cubes',
  garnish: 'Lemon twist',
  notes: null,
};
const lists = { methods: [{ id: 'm1', name: 'Shaken' }], glasses: [], ice: [{ id: 'i1', name: 'Cubes' }] };
const choices = { ...startChoices(recipe), lines: {} };
const draft = recipeDraft(recipe, choices, data, lists, 'ml');

// Pours in your usual unit; a top stays a top.
assert.deepEqual(draft.lines.map((l) => [l.name, l.amount, l.unit]), [
  ['Calvados', '45', 'ml'],
  ['Pear', '15', 'ml'],
  ['Honey Syrup 2:1', '15', 'ml'],
  ['Soda Water', '', 'top'],
]);
assert.equal(draft.lines[0].id, 'calv');
// The new prep comes with its recipe read from the ratio.
assert.deepEqual(draft.lines[2].prep?.lines.map((l) => [l.name, l.parts]), [['Honey', 2], ['Water', 1]]);
// Known method and ice are picked; an unknown glass goes in the notes; where it's from is noted.
assert.deepEqual(draft.methods, [{ id: 'm1', name: 'Shaken' }]);
assert.equal(draft.glass, null);
assert.equal(draft.ice?.id, 'i1');
assert.equal(draft.notes, 'From Little Rye\nGlass: Collins');
assert.equal(draft.creator, 'nobody');
assert.deepEqual(draft.garnishes.map((g) => [g.name, g.unit]), [['Lemon twist', 'twist']]);

// "Pear" fits two bottles of pear liqueur: unpicked, it saves as the plain kind and the footer says so.
assert.equal(openPickLine(recipe, choices, data), null, 'Pear matches the plain kind by name');
const pickRecipe = { ...recipe, lines: [{ amount: 15, unit: 'ml', ingredient: 'Pear Liqueur Brillet Rothman', unsure: false }] };
const withPicks = recipeDraft(pickRecipe, startChoices(pickRecipe), data, lists, 'ml');
assert.ok(withPicks.lines[0].name);

assert.equal(prepFromRatio('Fig syrup'), null);
console.log('bringInDraft checks passed');
