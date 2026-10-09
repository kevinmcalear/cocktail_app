// Checks for lib/servedAt.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { foldIntoClassics, servedCaption, specNoteText, splitVersions, versionLabel } from './servedAt';

const bar = (name: string) => ({ name, logo: null });

assert.equal(servedCaption(0, []), undefined);
assert.equal(servedCaption(1, [bar("Harry's Bar")]), "Served at Harry's Bar");
assert.equal(servedCaption(2, [bar("Harry's Bar"), bar('The Gold Room')]), "Served at Harry's Bar and The Gold Room");
assert.equal(servedCaption(7, [bar("Harry's Bar"), bar('The Gold Room'), bar('The Lions')]), "Served at Harry's Bar, The Gold Room +5");
// The count can say more bars than the names the server sent.
assert.equal(servedCaption(3, [bar("Harry's Bar")]), "Served at Harry's Bar +2");

assert.equal(specNoteText(undefined), undefined);
assert.equal(specNoteText({}), undefined);
assert.equal(specNoteText({ swaps: [{ to: 'Rye Whiskey', from: 'Bourbon', base: true }] }), 'uses Rye Whiskey, not Bourbon');
assert.equal(specNoteText({ measures: true }), 'different measures');
assert.equal(
  specNoteText({ adds: [{ name: 'Mezcal' }, { name: 'Honey Butter', house: true }], drops: ['Campari'] }),
  'adds Mezcal and a house Honey Butter; no Campari'
);
assert.equal(specNoteText({ adds: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }), 'adds A, B and C');

// Bar versions of a classic: one row per bar pouring it as it is, then variations, then riffs.
const verdicts: Record<string, string> = { a: 'same', b: 'same', c: 'unlisted', d: 'variation', e: 'riff' };
const split = splitVersions(
  [{ id: 'a', barId: 'harrys' }, { id: 'b', barId: 'harrys' }, { id: 'c', barId: 'lions' }, { id: 'd', barId: 'foco' }, { id: 'e', barId: 'goto' }, { id: 'f', barId: 'x' }],
  (id) => verdicts[id]
);
assert.deepEqual(split.served.map((v) => v.id), ['a', 'c']);
assert.deepEqual(split.variations.map((v) => v.id), ['d']);
// No verdict yet reads as a riff.
assert.deepEqual(split.riffs.map((v) => v.id), ['e', 'f']);

// A row's label.
assert.equal(versionLabel({ spec_match: 'same' }), 'the classic spec');
assert.equal(versionLabel({ spec_match: 'variation', notes: { measures: true } }), 'different measures');
assert.equal(versionLabel({ spec_match: 'variation', notes: {} }), 'a variation');
assert.equal(versionLabel({ spec_match: 'unlisted' }), undefined);
assert.equal(versionLabel(null), undefined);

// Search folds a bar's copy of a classic in the results into it, once per bar; the rest stay.
const at = (id: string, bar: string) => ({ id, bar: { name: bar, logo: null } });
const sm: Record<string, { spec_match: string; classic_id: string }> = {
  g1: { spec_match: 'same', classic_id: 'boul' },
  g2: { spec_match: 'unlisted', classic_id: 'boul' },
  g3: { spec_match: 'same', classic_id: 'boul' },
  v1: { spec_match: 'variation', classic_id: 'boul' },
  m1: { spec_match: 'same', classic_id: 'martini' },
};
const folded = foldIntoClassics([at('g1', 'Gold Room'), at('g2', 'The Lions'), at('g3', 'Gold Room'), at('v1', 'FOCO'), at('m1', 'Dante'), at('x', 'Bar X')], new Set(['boul']), (id) => sm[id]);
assert.deepEqual(folded.drinks.map((d) => d.id), ['v1', 'm1', 'x'], 'variations, classics not in the results, and unknowns stay');
assert.deepEqual(folded.servedBy.boul.map((b) => b.name), ['Gold Room', 'The Lions']);
