// Checks for lib/thenAndNow.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { stillEqual, thenAndNow } from './thenAndNow';

// The Last Word, 1951 against today's page: equal parts then and now.
const printed = [
  { ingredient_text: 'Dry gin', amount_text: '¼' },
  { ingredient_text: 'Green Chartreuse', amount_text: '¼' },
  { ingredient_text: 'Maraschino', amount_text: '¼' },
  { ingredient_text: 'Fresh lime juice', amount_text: '¼' },
];
const page = [
  { ingredient: 'London dry gin', ml: 22.5 },
  { ingredient: 'Green Chartreuse', ml: 22.5 },
  { ingredient: 'Maraschino liqueur', ml: 22.5 },
  { ingredient: 'Lime juice', ml: 22.5 },
];
const rows = thenAndNow(printed, page);
assert.deepEqual(rows.map((r) => r.now), [22.5, 22.5, 22.5, 22.5]);
assert.equal(stillEqual(rows), 'Still equal parts.');

// A line the page doesn't have reads as nothing; the parts aren't called equal then.
const short = thenAndNow(printed, page.slice(0, 3));
assert.equal(short[3].now, null);
assert.equal(stillEqual(short), null);

// Different measures now: no claim.
assert.equal(stillEqual(thenAndNow(printed, page.map((l, i) => ({ ...l, ml: i ? 22.5 : 30 })))), null);

// Without amounts on either side there's no table.
assert.deepEqual(thenAndNow(printed, page.map((l) => ({ ...l, ml: null }))), []);
assert.deepEqual(thenAndNow(printed.map((p) => ({ ...p, amount_text: null })), page), []);
