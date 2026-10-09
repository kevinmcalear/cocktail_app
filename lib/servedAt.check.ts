// Checks for lib/servedAt.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { servedCaption, specNoteText } from './servedAt';

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
