import assert from 'node:assert/strict';

import { houseMadeValue } from './menuPageModel';

// The bartender's row on a menu page (Menu-page): "House-made for this menu · 4 · grenadine low".
assert.equal(houseMadeValue(0, []), 'None');
assert.equal(houseMadeValue(4, []), '4');
assert.equal(houseMadeValue(4, ['Grenadine']), '4 · grenadine low');
assert.equal(houseMadeValue(4, ['Grenadine', 'Honey syrup']), '4 · grenadine and honey syrup low');
assert.equal(houseMadeValue(5, ['A', 'B', 'C']), '5 · 3 low', 'more than two low says how many');

console.log('houseMade checks passed');
