// Checks for lib/serviceDay.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { msUntilTurnover, serviceDate } from './serviceDay';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const day = (now: Date) => {
  const s = serviceDate(now);
  return [s.getFullYear(), s.getMonth() + 1, s.getDate()];
};

// --- the date turns over at 6am, not midnight ---
assert.deepEqual(day(at(2026, 10, 10, 12)), [2026, 10, 10], 'midday is today');
assert.deepEqual(day(at(2026, 10, 10, 23, 59)), [2026, 10, 10], 'late evening is today');
assert.deepEqual(day(at(2026, 10, 11, 0, 30)), [2026, 10, 10], 'after midnight is still last night');
assert.deepEqual(day(at(2026, 10, 11, 5, 59)), [2026, 10, 10], 'just before 6am is still last night');
assert.deepEqual(day(at(2026, 10, 11, 6, 0)), [2026, 10, 11], '6am is the new day');

// --- across months and years ---
assert.deepEqual(day(at(2026, 11, 1, 2)), [2026, 10, 31], 'the 1st before 6am is the last of the month');
assert.deepEqual(day(at(2027, 1, 1, 3)), [2026, 12, 31], 'New Year before 6am is New Year’s Eve');
assert.deepEqual(day(at(2028, 3, 1, 1)), [2028, 2, 29], 'a leap year’s 29 February');

// --- the next turnover ---
const HOUR = 3_600_000;
assert.equal(msUntilTurnover(at(2026, 10, 11, 5)), HOUR, '5am: an hour to go');
assert.equal(msUntilTurnover(at(2026, 10, 11, 0)), 6 * HOUR, 'midnight: six hours');
assert.equal(msUntilTurnover(at(2026, 10, 11, 6)), 24 * HOUR, 'at 6am: the next one is tomorrow');
assert.equal(msUntilTurnover(at(2026, 10, 10, 18)), 12 * HOUR, '6pm: twelve hours');
// Whatever the zone and its clock changes, waiting that long lands on 6am of the next service day.
for (const now of [at(2026, 3, 29, 1), at(2026, 10, 4, 1), at(2026, 10, 25, 4), at(2026, 11, 1, 1), at(2026, 4, 5, 23)]) {
  const next = new Date(now.getTime() + msUntilTurnover(now));
  assert.equal(next.getHours(), 6, `${now.toString()} waits until 6am`);
  assert.ok(next > now && next.getTime() - now.getTime() <= 25 * HOUR, `${now.toString()} waits less than a day`);
}

console.log('serviceDay checks passed');
