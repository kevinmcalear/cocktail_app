// Checks for lib/brandColours.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { colourName, contrastLines } from './brandColours';

assert.equal(colourName('#D0643B'), 'Rust');
assert.equal(colourName('#FBE9D8'), 'Cream');
assert.equal(colourName('#241C17'), 'Ink');
assert.equal(colourName('#808080'), 'Stone');
assert.equal(colourName('#2F6FD0'), 'Blue');

// Rust on Walnut, as the canvas draws it: four lines, the light-ground one deepened.
const lines = contrastLines('#D0643B', '#1A1410', null);
assert.equal(lines.length, 4);
assert.equal(lines[0].label, 'Rust on Walnut, dark mode');
assert.equal(lines[0].verdict, 'Passes');
assert.equal(lines[1].label, 'Ink on Rust, buttons');
assert.equal(lines[2].label, 'Rust on light ground');
assert.match(lines[2].verdict, /^Too light for text, so light mode uses #[0-9A-F]{6} \(\d\.\d : 1\)$/);
assert.equal(lines[3].label, 'Cream on Rust');
assert.equal(lines[3].verdict, 'Big type only, so buttons use Ink');

// Picking cream deepens the button instead.
const cream = contrastLines('#D0643B', null, 'cream');
assert.equal(cream[1].label, 'Cream on Rust, buttons');
assert.match(cream[1].verdict, /^Passes on a deeper #/);
assert.equal(cream[0].label, 'Rust on the ground, dark mode');

console.log('brandColours checks passed');
