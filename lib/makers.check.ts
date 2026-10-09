import assert from 'node:assert/strict';

import { andList, makesLine, servesLine } from './makers';

assert.equal(andList([]), '');
assert.equal(andList(['ice']), 'ice');
assert.equal(andList(['ice', 'glassware']), 'ice and glassware');
assert.equal(andList(['a', 'b', 'c']), 'a, b and c');

assert.equal(makesLine(['ice']), 'Makes ice');
// In the list's order, whatever order they were saved in; unknown values skipped.
assert.equal(makesLine(['glassware', 'napkins', 'bottles']), 'Makes bottles and glassware');
assert.equal(makesLine(['equipment']), 'Makes bar equipment');
assert.equal(makesLine([]), 'Maker');
assert.equal(makesLine(null), 'Maker');

assert.equal(servesLine(['New York', ' Jersey City ']), 'Delivers to New York and Jersey City');
assert.equal(servesLine(['  ']), null);
assert.equal(servesLine(undefined), null);

console.log('makers: ok');
