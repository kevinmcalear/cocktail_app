// Checks for lib/study.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { dayKey, glassOptions, knownCount, orderDeck, streak } from './study';

const progress = {
  a: { rating: 'nailed' as const, seenAt: '2026-09-20T10:00:00Z' },
  b: { rating: 'again' as const, seenAt: '2026-09-25T10:00:00Z' },
  c: { rating: 'close' as const, seenAt: '2026-09-21T10:00:00Z' },
  d: { rating: 'again' as const, seenAt: '2026-09-22T10:00:00Z' },
};
assert.deepEqual(orderDeck(['a', 'b', 'c', 'd', 'e'], progress), ['e', 'd', 'b', 'c', 'a'], 'unseen, then again (oldest first), close, nailed');
assert.equal(knownCount(['a', 'b', 'c'], progress), 1);

const today = new Date(2026, 8, 26);
assert.equal(dayKey(today), '2026-09-26');
assert.equal(streak(['2026-09-26', '2026-09-25', '2026-09-24'], today), 3);
assert.equal(streak(['2026-09-25', '2026-09-24'], today), 2, 'a streak survives until today ends');
assert.equal(streak(['2026-09-24'], today), 0, 'a missed day breaks it');
assert.equal(streak([], today), 0);

const glasses = [
  { id: 'coupe', name: 'Coupe', icon: 'Coupe' },
  { id: 'rocks', name: 'Rocks', icon: 'Rocks' },
  { id: 'nn', name: 'Nick & Nora', icon: 'Coupette' },
  { id: 'hb', name: 'Highball', icon: 'Highball' },
];
const opts = glassOptions(glasses[1], glasses, 'penicillin');
assert.equal(opts.length, 3);
assert.ok(opts.some((o) => o.id === 'rocks'), 'always includes the right glass');
assert.equal(new Set(opts.map((o) => o.id)).size, 3, 'no duplicates');
assert.deepEqual(glassOptions(glasses[1], glasses, 'penicillin'), opts, 'stable for the same drink');
assert.equal(glassOptions(glasses[0], [glasses[0]], 'x').length, 1, 'works with only one glass known');

console.log('study: ok');
