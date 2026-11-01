import assert from 'node:assert/strict';

import { repertoire, type ListDates } from '@/lib/repertoire';

import { bringBackNote, firstOn, ourDrinksEyebrow, runLine, shownGroups } from './ourDrinks';

const NOW = new Date(2026, 10, 1, 12).getTime();
const base: ListDates = { itemId: 'x', listName: 'Cocktails', startsOn: null, endsOn: null, startYear: null, startMonth: null, endYear: null, endMonth: null, isCurrent: false };
const r = (o: Partial<ListDates>): ListDates => ({ ...base, ...o });
// Month names follow the phone's locale; these read the same in en-US and en-GB.
const mon = (m: number, y?: number) => new Date(2000 + (y ? y - 2000 : 0), m - 1, 1).toLocaleDateString(undefined, y ? { month: 'short', year: 'numeric' } : { month: 'short' });

// A run that ended, known to the day: the swap sheet's own range.
assert.ok(runLine(r({ startsOn: '2026-10-01', endsOn: '2026-11-01' }), NOW).startsWith('Cocktails · '));
assert.ok(runLine(r({ startsOn: '2026-10-01', endsOn: '2026-11-01' }), NOW).endsWith(' 2026'));
// Research history, known to the month.
assert.equal(runLine(r({ listName: 'Spring', startYear: 2025, startMonth: 3, endYear: 2025, endMonth: 5 }), NOW), `Spring · ${mon(3)} to ${mon(5, 2025)}`);
assert.equal(runLine(r({ listName: 'Winter', startYear: 2024, startMonth: 12, endYear: 2025, endMonth: 2 }), NOW), `Winter · ${mon(12, 2024)} to ${mon(2, 2025)}`);
assert.equal(runLine(r({ listName: 'Summer', startYear: 2025, startMonth: 7, endYear: 2025, endMonth: 7 }), NOW), `Summer · ${mon(7, 2025)}`);
// On now: the day while it's new, the month once it has been on half a year.
assert.ok(runLine(r({ isCurrent: true, startsOn: '2026-10-12', startYear: 2026, startMonth: 10 }), NOW).includes('12'));
// It reads like a run's range: no locale comma before the year.
assert.ok(/since \S+ \S+ 2026$/.test(runLine(r({ isCurrent: true, startsOn: '2026-10-12', startYear: 2026, startMonth: 10 }), NOW)));
assert.equal(runLine(r({ isCurrent: true, startsOn: '2025-03-01', startYear: 2025, startMonth: 3 }), NOW), `Cocktails · since ${mon(3, 2025)}`);
assert.equal(runLine(r({ isCurrent: true }), NOW), 'Cocktails');

// The eyebrow counts drinks that were ever on a list, since the first one went on.
const rep = repertoire(
  [{ id: 'a', name: 'Jack Rose' }, { id: 'b', name: 'Negroni' }, { id: 'c', name: 'R&D sour' }],
  [r({ itemId: 'a', startsOn: '2026-10-01', endsOn: '2026-11-01' }), r({ itemId: 'b', isCurrent: true, startYear: 2025, startMonth: 3 }), r({ itemId: 'a', startYear: 2025, startMonth: 6, endYear: 2025, endMonth: 8 })],
);
assert.equal(firstOn([...rep.past, ...rep.onNow]), mon(3, 2025));
assert.equal(ourDrinksEyebrow('Little Rye', rep), `Little Rye · 2 drinks since ${mon(3, 2025)}`);

// Filters and search.
assert.deepEqual(shownGroups(rep, 'all', '').past.map((d) => d.drink.id), ['a']);
assert.deepEqual(shownGroups(rep, 'past', '').onNow, []);
assert.deepEqual(shownGroups(rep, 'on', '').past, []);
assert.deepEqual(shownGroups(rep, 'all', 'negr').onNow.map((d) => d.drink.id), ['b']);
assert.deepEqual(shownGroups(rep, 'all', 'negr').past, []);

// Bring back's note: which run starts, and the earlier ones kept.
assert.equal(bringBackNote(2, 'today', false), 'A third run starts today. The first two stay on its page.');
assert.equal(bringBackNote(1, 'after tonight', false), 'A second run starts after tonight. Its first run stays on its page.');
assert.equal(bringBackNote(12, 'today', false), 'Another run starts today. The first 12 stay on its page.');
assert.equal(bringBackNote(2, 'today', true), 'It waits for approval. The first two stay on its page.');

console.log('ourDrinks ok');
