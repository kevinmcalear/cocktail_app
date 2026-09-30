// Checks for lib/menuEditions.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { menuDate, sortEditions } from './menuEditions';

assert.equal(menuDate({ year: 2023, month: 5 }), 'May 2023');
assert.equal(menuDate({ year: 2019, month: null }), '2019');
assert.equal(menuDate({ year: 2019, month: 12 }), 'December 2019');

// Newest first; a year-only menu after that year's dated ones.
assert.deepEqual(
  sortEditions([
    { name: 'B', year: 2022, month: null },
    { name: 'A', year: 2022, month: 3 },
    { name: 'C', year: 2024, month: 1 },
    { name: 'D', year: 2022, month: 11 },
  ]).map((e) => e.name),
  ['C', 'D', 'A', 'B']
);

console.log('menu editions checks passed');
