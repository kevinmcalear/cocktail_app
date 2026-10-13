import assert from 'node:assert/strict';

import { byRegion, regionHeading, suppliesLine } from './suppliers';

assert.equal(suppliesLine(['glassware', 'bottles']), 'Supplies bottles and glassware');
assert.equal(suppliesLine(['equipment']), 'Supplies bar equipment');
assert.equal(suppliesLine([]), 'Supplier');
assert.equal(suppliesLine(['napkins']), 'Supplier');

assert.equal(regionHeading('AU-VIC'), 'In Victoria');
assert.equal(regionHeading('AU-ACT'), 'In the ACT');
assert.equal(regionHeading('AU'), 'Across Australia');
assert.equal(regionHeading('US-NY'), 'In US-NY');

const groups = byRegion([
  { region: 'AU', name: 'a' },
  { region: 'AU-VIC', name: 'b' },
  { region: 'AU-NSW', name: 'c' },
  { region: 'AU-VIC', name: 'd' },
]);
assert.deepEqual(
  groups.map((g) => [g.heading, g.lines.map((l) => l.name)]),
  [
    ['In New South Wales', ['c']],
    ['In Victoria', ['b', 'd']],
    ['Across Australia', ['a']],
  ]
);

console.log('suppliers: ok');
