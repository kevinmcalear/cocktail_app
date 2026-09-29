import assert from 'node:assert/strict';

import { dayLabel, hadOnLine, parseDay, splitCollection, UNKNOWN_BAR } from './collection';

const now = Date.parse('2026-09-29T12:00:00Z');
const drink = (id: string, barName: string | null, liveMode: string | null, collectedAt: string) => ({ id, barName, liveMode, collectedAt });

// --- live drinks stay in order; past drinks group by bar, most recent bar first, unknown last ---
const { live, past } = splitCollection([
  drink('a', 'Little Rye', 'spec', '2026-09-28T00:00:00Z'),
  drink('b', 'Pale Moth', null, '2026-09-20T00:00:00Z'),
  drink('c', null, null, '2026-09-27T00:00:00Z'),
  drink('d', 'Little Rye', null, '2026-09-10T00:00:00Z'),
  drink('e', 'Little Rye', 'description', '2026-09-05T00:00:00Z'),
  drink('f', 'Pale Moth', null, '2026-09-01T00:00:00Z'),
]);
assert.deepEqual(live.map((d) => d.id), ['a', 'e']);
assert.deepEqual(past.map((g) => g.bar), ['Pale Moth', 'Little Rye', UNKNOWN_BAR]);
assert.deepEqual(past[0].drinks.map((d) => d.id), ['b', 'f']);
assert.deepEqual(splitCollection([]), { live: [], past: [] });

// --- typed dates: real days only, normalised ---
assert.equal(parseDay('2026-09-27'), '2026-09-27');
assert.equal(parseDay(' 2026-9-7 '), '2026-09-07');
assert.equal(parseDay('2026-02-30'), null);
assert.equal(parseDay('27/09/2026'), null);
assert.equal(parseDay(''), null);

// --- labels: a day, not an instant; the year only when it isn't this year ---
assert.equal(dayLabel('2026-09-27', now, 'en-GB'), 'Sun 27 Sept');
assert.equal(dayLabel('2025-12-31', now, 'en-GB'), 'Wed, 31 Dec 2025');
assert.equal(hadOnLine('2026-09-27', now, 'en-GB'), 'You had it on Sun 27 Sept');
assert.equal(hadOnLine(null, now), null);

console.log('collection checks passed');
