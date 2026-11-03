// Checks for lib/rankResult.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { DRINK_REASONS, entryLine, landedLine, MAX_DRINK_REASONS, monthHad, neighbours, ordinal, placeInList, ROOM_REASONS, stepCount, toggleReason } from './rankResult';
import type { Sentiment } from './ranking';

const e = (id: string, sentiment: Sentiment) => ({ id, sentiment });

// --- placeInList: the new drink lands in its band, every band rescored ---
const list = [e('a', 'loved'), e('b', 'loved'), e('c', 'fine'), e('d', 'disliked')];
{
  const rows = placeInList(list, 'loved', 1);
  assert.deepEqual(
    rows.map((r) => [r.entry?.id ?? 'new', r.position, r.score]),
    // loved now has three: 10.0, 8.9, 7.8 (private.rank_score with count 3); fine and disliked keep theirs.
    [
      ['a', 1, 10],
      ['new', 2, 8.9],
      ['b', 3, 7.8],
      ['c', 4, 6.6],
      ['d', 5, 3.3],
    ]
  );
  assert.deepEqual(
    neighbours(rows).map((r) => r.entry?.id ?? 'new'),
    ['a', 'new', 'b']
  );
}
{
  // A fine drink placed last in its band sits after every loved one.
  const rows = placeInList(list, 'fine', 5);
  assert.equal(rows.find((r) => !r.entry)?.position, 4);
  assert.equal(rows.length, 5);
}
{
  // An empty list: just the new one, at the top of its band.
  const rows = placeInList([], 'disliked', 0);
  assert.deepEqual(rows.map((r) => [r.position, r.score]), [[1, 3.3]]);
  assert.equal(neighbours(rows).length, 1);
}
// Neighbours keep three rows when the new one is first or last.
assert.deepEqual(neighbours(placeInList(list, 'loved', 0)).map((r) => r.entry?.id ?? 'new'), ['new', 'a', 'b']);
assert.deepEqual(neighbours(placeInList(list, 'disliked', 1)).map((r) => r.entry?.id ?? 'new'), ['c', 'd', 'new']);

// --- the line under the score ---
assert.equal(landedLine(2, 7, 'Negroni'), 'Your second-best Negroni, out of 7.');
assert.equal(landedLine(1, 3, 'Martini'), 'Your best Martini, out of 3.');
assert.equal(landedLine(1, 1, 'Martini'), 'Your first Martini.');
assert.equal(landedLine(12, 30, 'Daiquiri'), 'Your 12th best Daiquiri, out of 30.');
assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);

// --- "2 of 3" ---
assert.equal(stepCount(0, 3), '1 of 3');
assert.equal(stepCount(1, 2), '2 of 3');

// --- reasons: two at most for the drink, the room has no cap ---
assert.deepEqual(toggleReason([], 'beautiful', MAX_DRINK_REASONS), ['beautiful']);
assert.deepEqual(toggleReason(['beautiful', 'order_again'], 'watery', MAX_DRINK_REASONS), ['beautiful', 'order_again']);
assert.deepEqual(toggleReason(['beautiful', 'order_again'], 'beautiful', MAX_DRINK_REASONS), ['order_again']);
assert.deepEqual(toggleReason(['loud'], 'cramped'), ['loud', 'cramped']);
// The month a row says, with the year only before this one.
const now = new Date(2026, 10, 1);
assert.equal(monthHad({ had_on: '2026-08-14', created_at: '2026-08-15T01:00:00Z' }, now), 'August');
assert.equal(monthHad({ had_on: null, created_at: '2025-08-15T12:00:00Z' }, now), 'August 2025');
assert.equal(entryLine({ had_on: '2026-08-14', created_at: '', item: { name: 'Crimson Peel' } }, 'Manhattan', now), 'Crimson Peel · August');
assert.equal(entryLine({ had_on: '2026-08-14', created_at: '', item: { name: 'Manhattan' } }, 'Manhattan', now), 'August');

const full = ['beautiful', 'order_again'];
assert.equal(toggleReason(full, 'watery', MAX_DRINK_REASONS), full, 'at the cap the same list comes back, so nothing is written');

// The keys are the ones the database accepts (20261206200000_rank_reasons.sql).
assert.deepEqual(
  DRINK_REASONS.map((r) => r.key),
  ['too_sweet', 'too_strong', 'watery', 'beautiful', 'order_again']
);
assert.deepEqual(
  ROOM_REASONS.map((r) => r.key),
  ['great_room', 'easy_to_talk', 'good_music', 'loud', 'cramped', 'too_dark']
);

console.log('rankResult.check: ok');
