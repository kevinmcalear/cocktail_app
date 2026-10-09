import assert from 'node:assert/strict';
import { belongsHere, inSelectedContext, PERSONAL_CONTEXT, venueContextIds } from './barContextFilter';

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

// Search's recents at home listed the last venue's drinks and drafts.
const mine = ['cottage', 'shapes'];
assert.equal(belongsHere('cottage', mine, null), false);
assert.equal(belongsHere('cottage', mine, 'shapes'), false);
assert.equal(belongsHere('cottage', mine, 'cottage'), true);
assert.equal(belongsHere(null, mine, 'cottage'), true);
assert.equal(belongsHere('a-bar-on-discover', mine, null), true);

console.log('barContextFilter.check: ok');
