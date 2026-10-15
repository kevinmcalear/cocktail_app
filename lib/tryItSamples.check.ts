// Run: node --import tsx lib/tryItSamples.check.ts (npm run test:unit runs it).
import assert from 'node:assert/strict';

import { oldFashionedLine, SAMPLE_BOTTLES, toggleBottle, TRY_IT_COPY } from './tryItSamples';
import { VENUE_FEATURES } from './venueFeatures';

// --- the sheet opens on the canvas's ticks, and the Old Fashioned is in stock ---
const start = SAMPLE_BOTTLES.filter((b) => b.have).map((b) => b.id);
assert.deepEqual(start, ['rye', 'bourbon', 'campari', 'angostura']);
assert.equal(SAMPLE_BOTTLES.length, 6, 'six bottles, as drawn');
assert.equal(oldFashionedLine(start), 'Your Old Fashioned: everything in stock');

// --- it follows the ticks: rye and Angostura are bottles, demerara is made in house ---
assert.equal(oldFashionedLine(toggleBottle(start, 'angostura')), 'Your Old Fashioned: out of Angostura');
assert.equal(oldFashionedLine(toggleBottle(start, 'rye')), 'Your Old Fashioned: out of rye');
assert.equal(oldFashionedLine([]), 'Your Old Fashioned: out of rye and Angostura');
assert.equal(oldFashionedLine(toggleBottle(start, 'campari')), 'Your Old Fashioned: everything in stock', 'other bottles do not matter');
assert.equal(oldFashionedLine(toggleBottle(toggleBottle(start, 'rye'), 'rye')), 'Your Old Fashioned: everything in stock', 'ticking back undoes it');

// --- every feature the catalog says can be tried has a sample, and only those ---
const tryable = VENUE_FEATURES.filter((f) => 'tryIt' in f && f.tryIt).map((f) => f.key);
assert.deepEqual(tryable, ['tonight', 'backBar']);
assert.deepEqual(Object.keys(TRY_IT_COPY).sort(), [...tryable].sort());

console.log('tryItSamples checks passed');
