// Checks for lib/sameName.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { EMPTY_DRAFT } from './drinkWizard';
import { creditWaits, nameKey, nameLike, nameWaits, ontoBarLines, sameName, sheetWaits, specDifferences, stepWaits, storedLine, versionHeading, versionName } from './sameName';

// --- names ---
assert.equal(nameKey('  Vieux Carré (Ours) '), 'vieux carre ours');
assert.equal(nameKey("Tommy's  Margarita"), 'tommys margarita');
assert.ok(sameName('Negroni', ' negroni '));
assert.ok(sameName('Paper-Plane', 'paper plane'));
assert.ok(sameName('Vieux Carre', 'Vieux Carré'));
// Unlike the classic match, words in brackets count.
assert.ok(!sameName('Negroni (summer)', 'Negroni'));
assert.ok(!sameName('', ''));

// The pattern lets every spelling through; sameName sorts out the rest.
assert.equal(nameLike('Paper Plane'), '%p%_%p%_%r%p%l%_%_%_%');
assert.equal(nameLike('  '), null);
const like = (pattern: string, name: string) => new RegExp(`^${pattern.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(name);
for (const name of ['Vieux Carré', 'VIEUX CARRE', 'Vieux-Carre']) assert.ok(like(nameLike('Vieux Carre')!, name), name);
assert.ok(like(nameLike('Négroni')!, 'Negroni'));
// An apostrophe on either side: the stored one sits where the typed name has none, and the other way round.
for (const [typed, stored] of [["Tommy's Margarita", "Tommy's Margarita"], ['Tommys Margarita', "Tommy's Margarita"], ["Bee's Knees", 'Bees Knees'], ['Planters Punch', 'Planter’s Punch']]) {
  assert.ok(like(nameLike(typed)!, stored), `${typed} finds ${stored}`);
  assert.ok(sameName(typed, stored), `${typed} is ${stored}`);
}

assert.equal(versionName('Negroni', ' summer '), 'Negroni (summer)');
assert.equal(versionName('Negroni', ''), 'Negroni');

// --- what waits ---
const bar = { id: 'b1' };
const draft = { ...EMPTY_DRAFT, name: 'Negroni' };
assert.ok(nameWaits(draft, bar), 'the bar has one and nothing is picked');
assert.ok(!nameWaits(draft, null), 'no drink by that name');
const version = { id: 'b1', name: 'Negroni', bar: 'Little Rye', as: 'version' as const, word: '' };
assert.ok(nameWaits({ ...draft, sameAs: version }, bar), 'a version waits for its word');
assert.ok(!nameWaits({ name: 'Negroni (summer)', sameAs: { ...version, word: 'summer' } }, null));
const different = { id: 'b1', name: 'Negroni', bar: 'Little Rye', as: 'different' as const };
assert.ok(nameWaits({ ...draft, sameAs: different }, bar), 'a different drink with the same name still waits');
assert.ok(!nameWaits({ name: 'Negroni Bianco', sameAs: different }, null));
// A pick for another drink doesn't answer this one.
assert.ok(nameWaits({ ...draft, sameAs: { ...different, id: 'other' } }, bar));

assert.ok(creditWaits(draft, { id: 'v1' }));
assert.ok(!creditWaits({ sameAs: { ...version, id: 'v1' } }, { id: 'v1' }));
assert.ok(stepWaits('credits', draft, null, { id: 'v1' }));
assert.ok(!stepWaits('method', draft, bar, { id: 'v1' }));
// Still looking the name up: the name, credits and review steps wait (not the ones between).
assert.ok(stepWaits('name', { ...draft, name: 'Negroni Bianco' }, null, null, true));
assert.ok(stepWaits('review', draft, null, null, true));
assert.ok(!stepWaits('method', draft, null, null, true));
assert.ok(!stepWaits('review', draft, null, null, false));

assert.deepEqual(versionHeading({ sameAs: version }), { eyebrow: 'Version of Little Rye’s Negroni', title: 'What’s different about this one?' });
assert.equal(versionHeading({ sameAs: different }), null);

// --- comparing specs ---
const line = (id: string | null, name: string, amount: string, unit: string) => ({ id, name, amount, unit });
const sheet = [line('rye', 'Rye whiskey', '60', 'ml'), line('fig', 'Fig syrup', '15', 'ml'), line(null, 'Walnut bitters', '2', 'dash')];
const ours = [line('rye', 'Rye Whiskey', '50', 'ml'), line('fig', 'Fig syrup', '15', 'ml'), line('wal', 'Walnut Bitters', '1', 'dash'), line('ora', 'Orange', '1', 'peel')];
assert.deepEqual(specDifferences(sheet, ours), [
  { name: 'Rye whiskey', sheet: '60 ml', bar: '50 ml' },
  { name: 'Walnut bitters', sheet: '2 dash', bar: '1 dash' },
  { name: 'Orange', sheet: null, bar: '1 peel' },
]);
assert.deepEqual(specDifferences(sheet, sheet), [], 'the same spec');
assert.deepEqual(specDifferences([line('x', 'Gin', '50', 'ml')], []), [{ name: 'Gin', sheet: '50 ml', bar: null }]);

// Stored pours are shown in the sheet's unit.
assert.deepEqual(storedLine({ id: 'g', name: 'Gin', amount: 1, unit: 'oz' }, 'ml'), { id: 'g', name: 'Gin', amount: '30', unit: 'ml' });
assert.deepEqual(storedLine({ id: 'o', name: 'Orange', amount: null, unit: 'peel' }, 'ml'), { id: 'o', name: 'Orange', amount: '', unit: 'peel' });

// --- what a Bring in drink waits on ---
const differs = [{ name: 'Rye whiskey', sheet: '60 ml', bar: '50 ml' }];
assert.equal(sheetWaits(null, differs, null), false, 'nothing by that name');
assert.equal(sheetWaits(bar, [], null), 'same', 'the same spec: nothing to save');
assert.equal(sheetWaits(bar, differs, null), true, 'a different spec waits for a pick');
assert.equal(sheetWaits(bar, differs, { id: 'b1', as: 'update' }), false);
assert.equal(sheetWaits(bar, differs, { id: 'b1', as: 'keep', word: ' ' }), true, 'Keep both waits for its word');
assert.equal(sheetWaits(bar, differs, { id: 'b1', as: 'keep', word: 'stronger' }), false);
assert.equal(sheetWaits(bar, differs, { id: 'other', as: 'update' }), true);

// --- Update it: the sheet's lines onto the bar's rows ---
const sheetLines = [
  { id: null, ingredient_item_id: 'rye', amount: 60, unit: 'ml', preparation_notes: null, is_optional: false },
  { id: null, ingredient_item_id: 'fig', amount: 15, unit: 'ml', preparation_notes: 'warm', is_optional: false },
  { id: null, ingredient_item_id: 'new', amount: 2, unit: 'dash', preparation_notes: null, is_optional: false },
];
const barRows = [
  { id: 'r1', ingredient_item_id: 'rye', preparation_notes: 'chilled', is_optional: false },
  { id: 'r2', ingredient_item_id: 'fig', preparation_notes: 'house', is_optional: true },
  { id: 'r3', ingredient_item_id: 'orange', preparation_notes: null, is_optional: false },
];
assert.deepEqual(ontoBarLines(sheetLines, barRows), [
  { id: 'r1', ingredient_item_id: 'rye', amount: 60, unit: 'ml', preparation_notes: 'chilled', is_optional: false },
  { id: 'r2', ingredient_item_id: 'fig', amount: 15, unit: 'ml', preparation_notes: 'warm', is_optional: true },
  { id: null, ingredient_item_id: 'new', amount: 2, unit: 'dash', preparation_notes: null, is_optional: false },
]);
// One bar row is kept once, even when the sheet has the ingredient twice.
assert.deepEqual(ontoBarLines([sheetLines[0], sheetLines[0]], barRows).map((l) => l.id), ['r1', null]);

console.log('sameName checks passed');
