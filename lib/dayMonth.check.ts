import assert from 'node:assert/strict';

import { dayMonth } from './dayMonth';

const d = new Date(2026, 10, 3, 20);
for (const locale of ['en-US', 'en-GB', 'en-AU']) {
  assert.equal(dayMonth(d, { weekday: 'long', month: 'long' }, locale), 'Tuesday 3 November', locale);
  assert.equal(dayMonth(d, { weekday: 'short', month: 'short' }, locale), 'Tue 3 Nov', locale);
  assert.equal(dayMonth(d, { month: 'short' }, locale), '3 Nov', locale);
}
console.log('dayMonth: day before month in every locale');
