// Checks for lib/brandColours.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { colourName } from './brandColours';

assert.equal(colourName('#D0643B'), 'Rust');
assert.equal(colourName('#FBE9D8'), 'Cream');
assert.equal(colourName('#241C17'), 'Ink');
assert.equal(colourName('#808080'), 'Stone');
assert.equal(colourName('#2F6FD0'), 'Blue');
assert.equal(colourName('#E4B062'), 'Amber');

console.log('brandColours checks passed');
