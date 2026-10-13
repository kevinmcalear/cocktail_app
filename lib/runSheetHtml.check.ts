// Checks for lib/runSheetHtml.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildRunSheet } from './runSheet';
import { runSheetHtml } from './runSheetHtml';

const sheet = buildRunSheet({
  hostName: 'Caretaker’s <Cottage>',
  drinks: [
    {
      id: 'neg', itemId: 'negroni', name: 'Negroni & Co', itemType: 'cocktail', serves: 200, byGuest: false, icePerServeG: null, ice: null,
      glass: { id: 'rocks', name: 'Rocks glass' },
      recipe: [{ ingredientId: 'gin', name: 'Gin', amount: 30, unit: 'ml' }, { ingredientId: 'twist', name: 'Orange twist', amount: 1, unit: 'each' }],
    },
  ],
  swaps: [],
  parties: [{ id: 'mill', kind: 'brand', name: 'Mill & Ash Gin', profileId: null }],
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
assert.match(html, /<strong>Mill &amp; Ash Gin<\/strong><span class="muted">Brand<\/span>/);
assert.match(html, /<td>Gin<\/td><td class="num">6 L · 9 × 700 ml<\/td>/);
assert.match(html, /<h3 class="drink">Negroni &amp; Co<\/h3><span class="num">× 200<\/span>/);
assert.match(html, /<th class="num">For 200<\/th><\/tr><tr><td>Gin<\/td><td class="num">30 ml<\/td><td class="num">6 L<\/td><\/tr><\/table>/, 'garnish lines stay out of the table');
assert.match(html, /Printed Tue, 13 Oct 2026 from the Halloween &lt;takeover&gt; menu/);

console.log('runSheetHtml checks passed');
