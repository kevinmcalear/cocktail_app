import assert from 'node:assert/strict';

import type { MenuDrink } from '@/types/menus';

import {
  addDrink,
  addSection,
  cannotAdd,
  copySections,
  filterLibrary,
  libraryNote,
  layoutChanged,
  layoutFromMenu,
  layoutProblem,
  moveDrink,
  moveSection,
  removeDrink,
  removeSection,
  savePayload,
  sectionRuleProblem,
  updateSection,
  type MenuLayout,
} from './menuLayout';

const drink = (id: string, kind: MenuDrink['kind'] = 'cocktail'): MenuDrink => ({
  id, name: id, kind, line: '', price: null, imageUrl: null, isSketch: false, glass: null,
});

const base: MenuLayout = layoutFromMenu({
  name: 'Winter menu',
  coverUrl: null,
  coverPosition: 50,
  sections: [
    { id: 's1', name: 'Stirred', minItems: 2, maxItems: 5, allowedTypes: ['cocktail'], drinks: [drink('martini'), drink('bolo')] },
    { id: 's2', name: 'Beer', minItems: 0, maxItems: 3, allowedTypes: ['beer'], drinks: [drink('pils', 'beer')] },
  ],
});
const stirred = (l: MenuLayout) => l.sections.find((s) => s.key === 's1')!;

// --- adding respects the section ---
assert.equal(cannotAdd(stirred(base), drink('martini')), 'Already in Stirred');
assert.equal(cannotAdd(stirred(base), drink('lager', 'beer')), 'Stirred doesn’t take beer');
assert.equal(cannotAdd(stirred(base), drink('champ')), null);
assert.deepEqual(stirred(addDrink(base, 's1', drink('champ'))).drinks.map((d) => d.id), ['martini', 'bolo', 'champ']);
assert.deepEqual(stirred(addDrink(base, 's1', drink('champ'), 0)).drinks.map((d) => d.id), ['champ', 'martini', 'bolo']);
assert.equal(addDrink(base, 's1', drink('martini')).sections[0], base.sections[0], 'a duplicate changes nothing');
assert.equal(addDrink(base, 's1', drink('lager', 'beer')).sections[0], base.sections[0], 'a wrong type changes nothing');
// The original is never touched.
assert.equal(base.sections[0].drinks.length, 2);

// --- moving and removing ---
assert.deepEqual(stirred(moveDrink(base, 's1', 0, 1)).drinks.map((d) => d.id), ['bolo', 'martini']);
assert.deepEqual(stirred(moveDrink(base, 's1', 1, 99)).drinks.map((d) => d.id), ['martini', 'bolo']);
assert.deepEqual(stirred(moveDrink(base, 's1', 1, -5)).drinks.map((d) => d.id), ['bolo', 'martini']);
assert.deepEqual(stirred(removeDrink(base, 's1', 'martini')).drinks.map((d) => d.id), ['bolo']);

// --- sections ---
const three = addSection(base, 'Long & bright');
assert.equal(three.sections.length, 3);
assert.equal(three.sections[2].id, null);
assert.deepEqual(moveSection(three, three.sections[2].key, -1).sections.map((s) => s.name), ['Stirred', 'Long & bright', 'Beer']);
assert.equal(moveSection(three, 's1', -1), three, 'the first section cannot move up');
assert.deepEqual(removeSection(three, 's2').sections.map((s) => s.name), ['Stirred', 'Long & bright']);
// Narrowing what a section takes drops what no longer fits.
const mixed = addDrink(updateSection(base, 's1', { name: 'All', minItems: 1, maxItems: null, allowedTypes: ['cocktail', 'beer'] }), 's1', drink('lager', 'beer'));
assert.deepEqual(stirred(updateSection(mixed, 's1', { name: 'Stirred', minItems: 1, maxItems: null, allowedTypes: ['cocktail'] })).drinks.map((d) => d.id), ['martini', 'bolo']);

// --- copies are new rows with fresh keys ---
const copied = copySections(base.sections, true);
assert.ok(copied.every((s) => s.id === null && s.key.startsWith('new-')));
assert.notEqual(copied[0].key, copied[1].key);
assert.deepEqual(copySections(base.sections, false)[0].drinks, []);

// --- validation mirrors the database ---
assert.equal(sectionRuleProblem({ name: ' ', minItems: 0, maxItems: null, allowedTypes: ['beer'] }), 'Give the section a name.');
assert.equal(sectionRuleProblem({ name: 'A', minItems: 0, maxItems: null, allowedTypes: [] }), 'Pick at least one kind of drink.');
assert.match(sectionRuleProblem({ name: 'A', minItems: 3, maxItems: 2, allowedTypes: ['beer'] }) ?? '', /at least the minimum/);
assert.match(sectionRuleProblem({ name: 'A', minItems: 0, maxItems: 0, allowedTypes: ['beer'] }) ?? '', /at least 1/);
assert.equal(sectionRuleProblem({ name: 'A', minItems: 0, maxItems: 1, allowedTypes: ['beer'] }), null);
assert.equal(layoutProblem({ ...base, name: '' }), 'Give the menu a name.');
assert.equal(layoutProblem({ ...base, sections: [] }), 'A menu needs at least one section.');
assert.equal(layoutProblem(base), null);

// --- what gets saved, and whether anything changed ---
assert.deepEqual(savePayload(base), [
  { id: 's1', name: 'Stirred', min_items: 2, max_items: 5, allowed_types: ['cocktail'], item_ids: ['martini', 'bolo'] },
  { id: 's2', name: 'Beer', min_items: 0, max_items: 3, allowed_types: ['beer'], item_ids: ['pils'] },
]);
assert.equal(layoutChanged(base, { ...base }), false);
assert.equal(layoutChanged(base, { ...base, name: 'Winter menu ' }), false, 'trailing spaces are not a change');
assert.equal(layoutChanged(base, moveDrink(base, 's1', 0, 1)), true);
assert.equal(layoutChanged(base, { ...base, coverUrl: 'https://x/y.jpg' }), true);

// --- the add-a-drink list ---
const library = [drink('Martini'), drink('Bolo Tie'), drink('Pilsner', 'beer'), drink('Champ Stamp')];
const elsewhere = { 'Champ Stamp': 'Autumn menu' };
const names = (ds: MenuDrink[]) => ds.map((d) => d.id);
assert.deepEqual(names(filterLibrary(library, { allowedTypes: ['cocktail'] }, '', false, elsewhere)), ['Martini', 'Bolo Tie', 'Champ Stamp']);
assert.deepEqual(names(filterLibrary(library, { allowedTypes: ['cocktail'] }, ' bolo ', false, elsewhere)), ['Bolo Tie']);
assert.deepEqual(names(filterLibrary(library, { allowedTypes: ['cocktail'] }, '', true, elsewhere)), ['Martini', 'Bolo Tie']);
assert.deepEqual(names(filterLibrary(library, { allowedTypes: ['beer'] }, '', false, elsewhere)), ['Pilsner']);
const section = { name: 'Stirred', drinks: [drink('Martini')] };
assert.equal(libraryNote({ id: 'Martini' }, section, elsewhere), 'Already in Stirred');
assert.equal(libraryNote({ id: 'Champ Stamp' }, section, elsewhere), 'On Autumn menu');
assert.equal(libraryNote({ id: 'Bolo Tie' }, section, elsewhere), 'Not on a menu');

console.log('menuLayout: ok');
