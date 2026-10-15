// Checks for lib/pageVisibility.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { PAGE_COPY, pageLocksSpecs, pageShowsDescriptions, specLockNote } from './pageVisibility';

// Below open, specs are kept from everyone but the bar's team; a person's page (null) never locks.
assert.equal(pageLocksSpecs('description', false), true);
assert.equal(pageLocksSpecs('locked', false), true);
assert.equal(pageLocksSpecs('locked', true), false);
assert.equal(pageLocksSpecs('open', false), false);
assert.equal(pageLocksSpecs(null, false), false);

// Only a locked page hides descriptions.
assert.equal(pageShowsDescriptions('locked'), false);
assert.equal(pageShowsDescriptions('description'), true);
assert.equal(pageShowsDescriptions(null), true);

// An unclaimed bar's note points at claiming; a claimed bar's says it keeps them.
assert.match(specLockNote('Pale Moth', true, false), /once Pale Moth claims this page/);
assert.match(specLockNote('Pale Moth', true, true), /Its spec shows once Pale Moth claims its page/);
assert.match(specLockNote('Little Rye', false, true), /Little Rye keeps its spec to its team/);

// The ladder's names, and Menu says ingredient names show (never "Specs stay private": they don't, quite).
assert.deepEqual([PAGE_COPY.locked.label, PAGE_COPY.description.label, PAGE_COPY.open.label], ['Names', 'Menu', 'Open']);
assert.match(PAGE_COPY.description.detail, /ingredients, without amounts/);
assert.doesNotMatch(PAGE_COPY.description.detail, /Specs stay private/);

console.log('pageVisibility checks passed');
