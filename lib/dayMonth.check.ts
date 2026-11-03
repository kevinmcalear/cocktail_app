import assert from 'node:assert/strict';

import { dayMonth } from './dayMonth';

const d = new Date(2026, 10, 3, 20);
for (const locale of ['en-US', 'en-GB', 'en-AU']) {
  assert.equal(dayMonth(d, { weekday: 'long', month: 'long' }, locale), 'Tuesday 3 November', locale);
  assert.equal(dayMonth(d, { weekday: 'short', month: 'short' }, locale), 'Tue 3 Nov', locale);
  assert.equal(dayMonth(d, { month: 'short' }, locale), '3 Nov', locale);
}
// The month keeps its form beside a day, and native digits stay.
assert.equal(dayMonth(d, { month: 'long' }, 'ru'), '3 ноября');
assert.match(dayMonth(d, { month: 'long' }, 'ar-EG'), /٣/);
assert.equal(dayMonth(new Date(2025, 10, 3), { weekday: 'short', month: 'short', year: 'numeric' }, 'en-US'), 'Mon 3 Nov 2025');
console.log('dayMonth: day before month in every locale');
