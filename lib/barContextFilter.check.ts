import assert from 'node:assert/strict';
import { contextLabel, inSelectedContext, PERSONAL_CONTEXT } from './barContextFilter';

const bars = [
  { bar_id: 'a', name: 'Oak' },
  { bar_id: 'b', name: 'Pine' },
];

assert.equal(contextLabel([PERSONAL_CONTEXT], bars), 'Personal');
assert.equal(contextLabel([PERSONAL_CONTEXT, 'a', 'b'], bars), 'All');
assert.equal(contextLabel(['a', 'b'], bars), 'All venues');
assert.equal(contextLabel(['a'], bars), 'Oak');
assert.equal(contextLabel([PERSONAL_CONTEXT, 'a'], bars), 'Personal + Oak');
// only one venue exists → personal + that venue is "All"
assert.equal(
  contextLabel([PERSONAL_CONTEXT, 'a'], [{ bar_id: 'a', name: 'Oak' }]),
  'All'
);

assert.equal(inSelectedContext(null, [PERSONAL_CONTEXT]), true);
assert.equal(inSelectedContext(null, ['a']), false);
assert.equal(inSelectedContext('a', ['a']), true);
assert.equal(inSelectedContext('a', ['b']), false);
assert.equal(inSelectedContext('a', [PERSONAL_CONTEXT, 'a']), true);

console.log('barContextFilter.check: ok');
