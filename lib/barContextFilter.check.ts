import assert from 'node:assert/strict';
import { inSelectedContext, PERSONAL_CONTEXT, venueContextIds } from './barContextFilter';

assert.equal(inSelectedContext(null, [PERSONAL_CONTEXT]), true);
assert.equal(inSelectedContext(null, ['a']), false);
assert.equal(inSelectedContext('a', ['a']), true);
assert.equal(inSelectedContext('a', ['b']), false);
assert.equal(inSelectedContext('a', [PERSONAL_CONTEXT, 'a']), true);

assert.deepEqual(venueContextIds('a', false), ['a']);
assert.deepEqual(venueContextIds('a', true), ['a']);
assert.deepEqual(venueContextIds(null, false), [PERSONAL_CONTEXT]);
// still loading: match nothing rather than flash personal items
assert.deepEqual(venueContextIds(null, true), []);
assert.equal(inSelectedContext(null, venueContextIds('a', false)), false);

console.log('barContextFilter.check: ok');
