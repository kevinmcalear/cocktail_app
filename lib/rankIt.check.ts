import assert from 'node:assert/strict';

import { namedFirst } from './discover';
import { anywhereRows, beforeLine, latestByDrink, menusOnNow, pickSuggestion, tonightEntry, tonightLine } from './rankIt';

// --- the suggested drink ---
const wants = [
  { itemId: 'new', name: 'Gimlet', barName: 'Little Rye' },
  { itemId: 'negroni', name: 'Negroni', barName: null },
  { itemId: 'old', name: 'Martini', barName: 'Somewhere' },
];
const names = new Map([
  ['caretakers', "Caretaker's"],
  ['rye', 'Little Rye'],
]);
const runs = [
  { item_id: 'new', profile_id: 'rye', edition_name: 'Winter', is_current: false },
  { item_id: 'negroni', profile_id: 'caretakers', edition_name: 'Autumn', is_current: true },
  { item_id: 'old', profile_id: 'rye', edition_name: 'Spring', is_current: true },
];
// A bar you love wins over a newer want elsewhere; a past menu never counts.
assert.deepEqual(pickSuggestion(wants, runs, new Set(['caretakers']), names), { itemId: 'negroni', name: 'Negroni', barId: 'caretakers', barName: "Caretaker's", menuName: 'Autumn' });
// No bar you love pours one: the newest want on a list on now anywhere.
assert.equal(pickSuggestion(wants, runs, new Set(), names)?.itemId, 'negroni');
// A bar we have no name for falls back on the want's own.
assert.equal(pickSuggestion([wants[2]], runs, new Set(), new Map())?.barName, 'Somewhere');
// Nothing on now: no suggestion.
assert.equal(pickSuggestion(wants, runs.map((r) => ({ ...r, is_current: false })), new Set(['caretakers']), names), null);
assert.equal(pickSuggestion([], runs, new Set(), names), null);

// --- tonight's ranking ---
const now = new Date('2026-11-01T01:00:00');
const entry = (itemId: string, hadOn: string | null, createdAt: string) => ({ itemId, score: 9, hadOn, createdAt });
const lastNight = entry('late', '2026-10-31', new Date('2026-10-31T23:00:00').toISOString());
const longAgo = entry('old', '2026-08-02', '2026-08-02T20:00:00.000Z');
// Ranked at 11pm still shows at 1am.
assert.equal(tonightEntry([longAgo, lastNight], now, '2026-11-01')?.itemId, 'late');
// A re-rank today (old created_at, today's had_on) counts, and comes first.
const reranked = entry('re', '2026-11-01', '2026-06-01T20:00:00.000Z');
assert.equal(tonightEntry([lastNight, reranked], now, '2026-11-01')?.itemId, 're');
// Nothing from tonight: null.
assert.equal(tonightEntry([longAgo], now, '2026-11-01'), null);
assert.equal(tonightLine({ venue: { name: "Caretaker's" } }), "Caretaker's · tonight");
assert.equal(tonightLine({ venue: null }), 'At home · tonight');

// --- "Your 8.4 in August" ---
assert.equal(beforeLine(8.4, '2026-08-14', now), 'Your 8.4 in August');
assert.equal(beforeLine(8, '2025-08-14', now), 'Your 8.0 in August 2025');
assert.equal(beforeLine(7.25, null, now), 'Your 7.3');
assert.equal(beforeLine(7, 'not a day', now), 'Your 7.0');

// The newest ranking of a drink is the one shown.
const latest = latestByDrink([entry('a', '2026-08-01', '2026-08-01T00:00:00Z'), { ...entry('a', '2026-09-01', '2026-09-01T00:00:00Z'), score: 6 }, entry('b', null, '2026-07-01T00:00:00Z')]);
assert.equal(latest.get('a')?.score, 6);
assert.equal(latest.get('b')?.itemId, 'b');

// --- Anywhere ---
assert.deepEqual(
  anywhereRows([
    { id: '1', name: 'Negroni' },
    { id: '2', name: 'Negroni Sbagliato' },
  ]).map((r) => r.sub),
  ['At home, or a bar not listed', 'A classic']
);
assert.equal(anywhereRows(Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, name: `${i}` }))).length, 4);

// --- Near you: named what's typed first ---
assert.deepEqual(
  namedFirst([{ name: 'Boulevardier' }, { name: 'Aged Negroni' }, { name: 'Negroni' }], 'negr').map((r) => r.name),
  ['Negroni', 'Aged Negroni', 'Boulevardier']
);

// --- menus on now ---
assert.deepEqual([...menusOnNow(runs)], [
  ['negroni:caretakers', 'Autumn'],
  ['old:rye', 'Spring'],
]);

console.log('rankIt checks passed');
