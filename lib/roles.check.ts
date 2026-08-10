import assert from 'node:assert/strict';

import { effectiveRole, roleLabel, viewAsOptions } from './roles';

assert.equal(effectiveRole(40, null), 40);
assert.equal(effectiveRole(40, 10), 10);
assert.equal(effectiveRole(20, 30), 20); // cannot elevate
assert.equal(effectiveRole(0, 10), 10);

assert.equal(roleLabel(35), 'Drink Creator');
assert.deepEqual(
  viewAsOptions(40).map((r) => r.level),
  [10, 20, 30, 35]
);
assert.deepEqual(
  viewAsOptions(20).map((r) => r.level),
  [10]
);
assert.deepEqual(viewAsOptions(10).map((r) => r.level), []);

console.log('roles.check: ok');
