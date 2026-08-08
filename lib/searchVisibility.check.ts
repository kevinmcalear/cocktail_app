import assert from 'node:assert/strict';
import { isHiddenFromSearch } from './searchVisibility';

assert.equal(isHiddenFromSearch({}), false);
assert.equal(isHiddenFromSearch({ hide_from_search: false }), false);
assert.equal(isHiddenFromSearch({ hide_from_search: true }), true);
assert.equal(isHiddenFromSearch({ draft_data: { hideFromSearch: true } }), true);
assert.equal(isHiddenFromSearch({ draft_data: { hideFromSearch: false } }), false);
assert.equal(
  isHiddenFromSearch({ hide_from_search: false, draft_data: { hideFromSearch: true } }),
  true
);

console.log('searchVisibility.check.ts: ok');
