import assert from 'node:assert/strict';

import { monthOf, monthWeeks, outside, shiftMonth, weekStart } from './calendar';

// --- October 2026 starts on a Thursday and has 31 days ---
const oct = monthWeeks({ year: 2026, month: 9 }, 1);
assert.equal(oct.length, 5);
assert.ok(oct.every((w) => w.length === 7));
assert.deepEqual(oct[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
assert.equal(oct[4][5], '2026-10-31');
assert.equal(oct[4][6], null);

// --- Sunday-first shifts the lead by one ---
const octSun = monthWeeks({ year: 2026, month: 9 }, 0);
assert.deepEqual(octSun[0].slice(0, 5), [null, null, null, null, '2026-10-01']);

// --- February in a leap year; a month that starts on the first weekday has no lead ---
assert.equal(monthWeeks({ year: 2028, month: 1 }, 1).flat().filter(Boolean).length, 29);
assert.equal(monthWeeks({ year: 2026, month: 5 }, 1)[0][0], '2026-06-01');

// --- months roll over years both ways ---
assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
assert.deepEqual(monthOf('2026-10-04'), { year: 2026, month: 9 });

// --- bounds are inclusive and optional ---
assert.equal(outside('2026-10-04', '2026-10-04'), false);
assert.equal(outside('2026-10-03', '2026-10-04'), true);
assert.equal(outside('2026-10-05', undefined, '2026-10-04'), true);
assert.equal(outside('2026-10-05'), false);

// --- week start follows the locale ---
assert.equal(weekStart('en-US'), 0);
assert.equal(weekStart('en-GB'), 1);
assert.equal(weekStart('de-DE'), 1);
