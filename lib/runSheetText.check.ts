// Checks for lib/runSheetText.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildRunSheet } from './runSheet';
import { needName, nightLine, partyList, partyListText, runSheetText, sheetHead } from './runSheetText';

process.env.TZ = 'UTC';
assert.equal(nightLine('2026-10-22T19:00:00Z', '2026-10-23T02:00:00Z'), 'Thu 22 Oct · 7 pm to 2 am');
assert.equal(nightLine('2026-10-22T19:30:00Z', null), 'Thu 22 Oct · 7:30 pm');
assert.equal(nightLine('2026-10-22', null), 'Thu 22 Oct');
assert.equal(nightLine(null, null), null);

const input: Parameters<typeof buildRunSheet>[0] = {
  hostName: "Caretaker's Cottage",
  drinks: [
    {
      id: 'neg', itemId: 'negroni', name: 'Negroni', itemType: 'cocktail', serves: 200, partyId: null, icePerServeG: null, ice: null,
      glass: { id: 'rocks', name: 'Rocks glass' },
      recipe: [{ ingredientId: 'gin', name: 'Gin', amount: 30, unit: 'ml' }, { ingredientId: 'twist', name: 'Orange twist', amount: 1, unit: 'each' }],
    },
    { id: 'mart', itemId: 'martini', name: 'Martini', itemType: 'cocktail', serves: null, partyId: null, icePerServeG: null, ice: null, glass: null, recipe: [] },
  ],
  swaps: [],
  parties: [{ id: 'mill', kind: 'brand', name: 'Mill & Ash Gin', profileId: null }, { id: 'rye', kind: 'guest', name: 'Little Rye', profileId: null }],
  owners: { gin: 'mill' },
  houseMade: {},
  purchasing: { gin: { supplierName: null, packAmount: 700, packUnit: 'ml' } },
  items: {},
  breakDownPreps: false,
};
const sheet = buildRunSheet(input);
const menu = { name: 'Halloween takeover', startsAt: '2026-10-22T19:00:00Z', endsAt: null };
assert.deepEqual(sheetHead(sheet, menu), {
  name: 'Halloween takeover',
  when: "Thu 22 Oct · 7 pm · Caretaker's Cottage",
  who: 'Little Rye visiting · with Mill & Ash Gin · 200 serves across 1 drink',
  extra: null,
});
assert.equal(sheetHead(buildRunSheet({ ...input, marginPct: 10 }), menu).extra, 'Amounts to make and buy include 10% extra for testing and tasting.');
// Who brings what says what each thing is: a glass, a garnish (i-runsheet-vague).
assert.equal(needName({ name: 'Nude pony', group: 'glassware' }), 'Nude pony (glass)');
assert.equal(needName({ name: 'Cherry', group: 'garnish' }), 'Cherry (garnish)');
assert.equal(needName({ name: 'Rocks glass', group: 'glassware' }), 'Rocks glass');
assert.equal(needName({ name: 'Gin', group: 'spirits' }), 'Gin');
const text = runSheetText(sheet, menu);
assert.match(text, /^RUN SHEET\nHalloween takeover\n/);
assert.match(text, /MILL & ASH GIN \(Brand\)\nSpirits and liqueurs:\n- Gin: 6 L · buy 9 × 700 ml/);
assert.match(text, /CARETAKER'S COTTAGE \(Venue\)\nGarnish:\n- Orange twist \(garnish\): 200\nGlassware:\n- Rocks glass: 200/);
assert.match(text, /Negroni × 200\nRocks glass · Orange twist\n- Gin: 30 ml, 6 L for 200/);
assert.doesNotMatch(text, /Martini|Little Rye \(Visiting/, 'no serves, nothing to bring: left out');

// One party's list, to send them: their part, from us, then everyone else's.
const mill = sheet.parties.find((p) => p.id === 'mill')!;
const list = partyList(sheet, menu, mill);
assert.deepEqual([list.eyebrow, list.title, list.when, list.from, list.ask], ['FOR MILL & ASH GIN', 'Your list for Halloween takeover', "Thu 22 Oct · 7 pm · Caretaker's Cottage", "From Caretaker's Cottage", 'Please bring']);
assert.deepEqual(list.others.map((o) => [o.name, o.needs.map((n) => n.name)]), [["Caretaker's Cottage", ['Orange twist', 'Rocks glass']]]);
assert.equal(partyListText(list), [
  'FOR MILL & ASH GIN', 'Your list for Halloween takeover', "Thu 22 Oct · 7 pm · Caretaker's Cottage", "From Caretaker's Cottage", '',
  'PLEASE BRING', '- Gin: 6 L · buy 9 × 700 ml', '', 'EVERYONE ELSE', "Caretaker's Cottage (Venue)", '- Orange twist (garnish): 200', '- Rocks glass: 200',
].join('\n'));
assert.equal(partyList(sheet, menu, sheet.parties[0]).ask, 'Please have ready', 'the bar it is at has things ready');

// A guest bar's own drink goes first on their list, with where to claim it while their page is unclaimed.
const theirs = buildRunSheet({ ...input, drinks: input.drinks.map((d) => (d.id === 'neg' ? { ...d, partyId: 'rye' } : d)) });
const rye = theirs.parties.find((p) => p.id === 'rye')!;
const ryeList = partyList(theirs, menu, rye, 'https://cocktail.test/p/littlerye');
assert.deepEqual(ryeList.drinks, [{ name: 'Negroni', serves: 200, makes: [] }]);
assert.equal(ryeList.claim, 'Negroni is on Cocktail, credited to Little Rye. Claim your page to see it: https://cocktail.test/p/littlerye');
assert.equal(partyListText(ryeList), [
  'FOR LITTLE RYE', 'Your list for Halloween takeover', "Thu 22 Oct · 7 pm · Caretaker's Cottage", "From Caretaker's Cottage", '',
  'YOUR DRINKS', '- Negroni × 200', '',
  'EVERYONE ELSE', "Caretaker's Cottage (Venue)", '- Orange twist (garnish): 200', '- Rocks glass: 200', 'Mill & Ash Gin (Brand)', '- Gin: 6 L · buy 9 × 700 ml', '',
  'Negroni is on Cocktail, credited to Little Rye. Claim your page to see it: https://cocktail.test/p/littlerye',
].join('\n'), 'nothing to bring: no Please bring');
assert.equal(partyList(theirs, menu, rye).claim, null, 'no page to claim: no claim line');
assert.deepEqual(partyList(theirs, menu, mill).drinks, [], "a brand has no drinks of its own");

console.log('runSheetText checks passed');
