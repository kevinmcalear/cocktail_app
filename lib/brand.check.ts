import assert from 'node:assert/strict';

import { GROUND_TINTS } from '../constants/tokens';

import { brandProblems, faceFromDb, faceToDb, normalizeHex, usableGroundTint } from './brand';

// Display faces round-trip between the database enum and the app's names.
for (const face of ['instrument', 'fraunces', 'bricolage'] as const) assert.equal(faceFromDb(faceToDb(face)), face);
assert.equal(faceFromDb(null), 'instrument');
assert.equal(faceFromDb('something-new'), 'instrument');

assert.equal(normalizeHex(' d0643b '), '#D0643B');
assert.equal(normalizeHex('#abc'), null);
assert.equal(normalizeHex('orange'), null);

// A dark tint is kept; one too light for dark-mode text is dropped.
assert.equal(usableGroundTint('#1A1410'), '#1A1410');
assert.equal(usableGroundTint('#D0643B'), null);
assert.equal(usableGroundTint('nope'), null);
assert.equal(usableGroundTint(null), null);
// Every preset on the brand screen must pass its own rule.
for (const t of GROUND_TINTS) assert.equal(usableGroundTint(t.hex), t.hex, t.label);

assert.deepEqual(brandProblems({ accent: '#D0643B', groundTint: '', shortName: 'Little Rye' }), {});
const bad = brandProblems({ accent: 'red', groundTint: '#FFFFFF', shortName: 'Little Rye Wine Bar' });
assert.ok(bad.accent && bad.groundTint && bad.shortName);

console.log('brand: ok');
