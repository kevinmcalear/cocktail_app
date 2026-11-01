// Checks for lib/runSheetHtml.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildRunSheet } from './runSheet';
import { partyListHtml, runSheetHtml } from './runSheetHtml';
import { partyList } from './runSheetText';

const sheet = buildRunSheet({
  hostName: 'Caretaker’s <Cottage>',
  drinks: [
    {
      id: 'neg', itemId: 'negroni', name: 'Negroni & Co', itemType: 'cocktail', serves: 200, partyId: null, icePerServeG: null, ice: null,
      glass: { id: 'rocks', name: 'Rocks glass' },
      recipe: [{ ingredientId: 'gin', name: 'Gin', amount: 30, unit: 'ml' }, { ingredientId: 'twist', name: 'Orange twist', amount: 1, unit: 'each' }],
    },
  ],
  swaps: [],
  parties: [{ id: 'mill', kind: 'brand', name: 'Mill & Ash Gin', profileId: null, logoUrl: 'https://x/mill.png?a=1&b=2' }],
  hostLogoUrl: 'javascript:alert(1)',
  marginPct: 10,
  owners: { gin: 'mill' },
  houseMade: {},
  purchasing: { gin: { supplierName: null, packAmount: 700, packUnit: 'ml' } },
  items: {},
  breakDownPreps: false,
});
const html = runSheetHtml(sheet, { name: 'Halloween <takeover>', startsAt: null, endsAt: null }, new Date('2026-10-13T12:00:00Z'));

assert.match(html, /^<!doctype html>/);
assert.match(html, /@page \{ size: A4/);
assert.match(html, /<h1>Halloween &lt;takeover&gt;<\/h1>/, 'names are escaped');
assert.doesNotMatch(html, /<takeover>|<Cottage>/);
assert.match(html, /<div class="logos"><img src="https:\/\/x\/mill.png\?a=1&amp;b=2" alt="Mill &amp; Ash Gin logo"><\/div>/, 'logos up top, only from the web');
assert.doesNotMatch(html, /javascript:/);
assert.match(html, /<span class="muted">Extra for testing<\/span><b>10%<\/b>/);
assert.match(html, /include 10% extra for testing and tasting/);
assert.match(html, /<img src="https:\/\/x\/mill.png\?a=1&amp;b=2" alt="Mill &amp; Ash Gin logo"><strong>Mill &amp; Ash Gin<\/strong><span class="muted">Brand<\/span><\/div><div class="group"><div class="group-title">Spirits and liqueurs<\/div>/);
assert.match(html, /<td class="tick"><span class="box"><\/span><\/td><td>Gin<\/td><td class="num">6.6 L<\/td><td class="buy">buy 10 × 700 ml<\/td>/);
assert.match(html, /<div class="group-title">Garnish<\/div><table><colgroup>.*?<\/colgroup><tr><td class="tick"><span class="box"><\/span><\/td><td>Orange twist<\/td><td class="num">220<\/td>/);
assert.match(html, /<div class="group-title">Glassware<\/div><table><colgroup>.*?<\/colgroup><tr><td class="tick"><span class="box"><\/span><\/td><td>Rocks glass<\/td><td class="num">200<\/td><td class="buy"><\/td>/);
assert.match(html, /<h3 class="drink">Negroni &amp; Co<\/h3><span class="num">× 200<\/span>/);
assert.match(html, /<th class="num">For 200<\/th><\/tr><tr><td>Gin<\/td><td class="num">30 ml<\/td><td class="num">6 L<\/td><\/tr><\/table>/, 'garnish lines stay out of the table');
assert.match(html, /Printed Tue, 13 Oct 2026 from the Halloween &lt;takeover&gt; menu/);

// One party's list as its own page.
const one = partyListHtml(partyList(sheet, { name: 'Halloween <takeover>', startsAt: null, endsAt: null }, sheet.parties[1]));
assert.match(one, /<div class="eyebrow">FOR MILL &amp; ASH GIN<\/div><h1>Your list for Halloween &lt;takeover&gt;<\/h1>/);
assert.match(one, /<h2>Please bring<\/h2><p class="muted">Amounts to make and buy include 10% extra/);
assert.match(one, /<td>Gin<\/td><td class="num">6.6 L<\/td><td class="buy">buy 10 × 700 ml<\/td>/);
assert.match(one, /<h2>Everyone else<\/h2><section class="party"><div class="party-head"><strong>Caretaker’s &lt;Cottage&gt;<\/strong><span class="muted">Venue<\/span>/);
assert.match(one, /<td>Orange twist<\/td><td class="num">220<\/td>/);

console.log('runSheetHtml checks passed');
