import assert from 'node:assert/strict';

import { repertoire, type ListDates } from './repertoire';

const d = (itemId: string, startsOn: string, endsOn: string | null, isCurrent = false): ListDates => ({ itemId, listName: 'Main', startsOn, endsOn, isCurrent });
const drinks = [{ id: 'martini' }, { id: 'clover' }, { id: 'lastword' }, { id: 'rnd' }];
const r = repertoire(drinks, [
  d('martini', '2025-03-01', '2025-09-30'),
  d('martini', '2026-10-01', null, true),
  d('clover', '2026-06-01', '2026-08-31'),
  d('lastword', '2026-01-01', '2026-09-30'),
]);

assert.deepEqual(r.onNow.map((x) => x.drink.id), ['martini']);
assert.equal(r.onNow[0].dates.length, 2);
assert.equal(r.onNow[0].dates[0].startsOn, '2026-10-01');
// The most recent to leave comes first.
assert.deepEqual(r.past.map((x) => x.drink.id), ['lastword', 'clover']);
assert.equal(r.past[0].leftOn, '2026-09-30');
assert.deepEqual(r.never.map((x) => x.drink.id), ['rnd']);

console.log('repertoire ok');
