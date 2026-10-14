// Checks for lib/runSheetText.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildRunSheet } from './runSheet';
import { nightLine, runSheetText, sheetHead } from './runSheetText';

process.env.TZ = 'UTC';
assert.equal(nightLine('2026-10-22T19:00:00Z', '2026-10-23T02:00:00Z'), 'Thu 22 Oct · 7 pm to 2 am');
assert.equal(nightLine('2026-10-22T19:30:00Z', null), 'Thu 22 Oct · 7:30 pm');
assert.equal(nightLine('2026-10-22', null), 'Thu 22 Oct');
assert.equal(nightLine(null, null), null);

const sheet = buildRunSheet({
  hostName: "Caretaker's Cottage",
  drinks: [
    {
      id: 'neg', itemId: 'negroni', name: 'Negroni', itemType: 'cocktail', serves: 200, byGuest: false, icePerServeG: null, ice: null,
      glass: { id: 'rocks', name: 'Rocks glass' },
      recipe: [{ ingredientId: 'gin', name: 'Gin', amount: 30, unit: 'ml' }, { ingredientId: 'twist', name: 'Orange twist', amount: 1, unit: 'each' }],
    },
    { id: 'mart', itemId: 'martini', name: 'Martini', itemType: 'cocktail', serves: null, byGuest: false, icePerServeG: null, ice: null, glass: null, recipe: [] },
  ],
  swaps: [],
  parties: [{ id: 'mill', kind: 'brand', name: 'Mill & Ash Gin', profileId: null }, { id: 'rye', kind: 'guest', name: 'Little Rye', profileId: null }],
  owners: { gin: 'mill' },
  houseMade: {},
  purchasing: { gin: { supplierName: null, packAmount: 700, packUnit: 'ml' } },
  items: {},
  breakDownPreps: false,
});
const menu = { name: 'Halloween takeover', startsAt: '2026-10-22T19:00:00Z', endsAt: null };
assert.deepEqual(sheetHead(sheet, menu), {
  name: 'Halloween takeover',
  when: "Thu 22 Oct · 7 pm · Caretaker's Cottage",
  who: 'Little Rye behind the bar · with Mill & Ash Gin · 200 serves across 1 drink',
});
const text = runSheetText(sheet, menu);
assert.match(text, /^RUN SHEET\nHalloween takeover\n/);
assert.match(text, /Mill & Ash Gin \(Brand\)\n- Gin: 6 L · 9 × 700 ml/);
assert.match(text, /Caretaker's Cottage \(Hosting\)\n- Orange twist: 200\n- Rocks glass: 200/);
assert.match(text, /Negroni × 200\nRocks glass · Orange twist\n- Gin: 30 ml, 6 L for 200/);
assert.doesNotMatch(text, /Martini|Little Rye \(Guest/, 'no serves, nothing to bring: left out');

console.log('runSheetText checks passed');
