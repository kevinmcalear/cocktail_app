import assert from 'node:assert/strict';

import { displayFaces, type DisplayFace } from '../constants/tokens';

import { brandProblems, faceFromDb, faceToDb, faceToSave, isUnknownFaceError, markBrand, normalizeHex, toPublicBrand, usableGroundTint } from './brand';

// Display faces round-trip between the database enum and the app's names.
const faces = Object.keys(displayFaces) as DisplayFace[];
assert.equal(faces.length, 8);
for (const face of faces) assert.equal(faceFromDb(faceToDb(face)), face);
assert.deepEqual(faces.slice(1).map(faceToDb), ['newsreader', 'im_fell_english', 'imbue', 'besley', 'bricolage_grotesque', 'belleza', 'big_shoulders']);
// The faces bars picked before the theme faces draw as the nearest one now (Kevin, 31 Oct).
assert.deepEqual(['fraunces', 'playfair_display', 'josefin_sans', 'tenor_sans'].map(faceFromDb), ['newsreader', 'imbue', 'bricolage', 'belleza']);
assert.equal(faceFromDb('constructor'), 'redaction');
// Saving other fields keeps an old face as stored; picking a face saves the new one.
assert.equal(faceToSave('newsreader', 'fraunces'), 'fraunces');
assert.equal(faceToSave('besley', 'fraunces'), 'besley');
assert.equal(faceFromDb(null), 'redaction');
assert.equal(faceFromDb('something-new'), 'redaction');
// A face from a newer build is kept when someone saves other fields here, and replaced when they pick one.
assert.equal(faceToSave('redaction', 'something-new'), 'something-new');
assert.equal(faceToSave('newsreader', 'something-new'), 'newsreader');
assert.equal(faceToSave('fell', 'instrument_serif'), 'im_fell_english');
assert.equal(faceToSave('redaction', null), 'instrument_serif');
// The error PostgREST returns for an enum value the database doesn't have yet.
assert.equal(isUnknownFaceError({ code: '22P02', message: 'invalid input value for enum venue_display_face: "tenor_sans"' }), true);
assert.equal(isUnknownFaceError({ code: '22P02', message: 'invalid input syntax for type uuid' }), false);
assert.equal(isUnknownFaceError(null), false);

assert.equal(normalizeHex(' d0643b '), '#D0643B');
assert.equal(normalizeHex('#abc'), null);
assert.equal(normalizeHex('orange'), null);

// A dark tint is kept; one too light for dark-mode text is dropped.
assert.equal(usableGroundTint('#1A1410'), '#1A1410');
assert.equal(usableGroundTint('#D0643B'), null);
assert.equal(usableGroundTint('nope'), null);
assert.equal(usableGroundTint(null), null);
// Every background the brand screen makes passes this rule: lib/palette.check.ts.

assert.deepEqual(brandProblems({ accent: '#D0643B', groundTint: '', shortName: 'Little Rye' }), {});
const bad = brandProblems({ accent: 'red', groundTint: '#FFFFFF', shortName: 'Little Rye Wine Bar' });
assert.ok(bad.accent && bad.groundTint && bad.shortName);

// A bar's public brand: a bad colour or empty strings read as none, and a mark only draws in a real accent.
const pub = toPublicBrand({ logo_url: '', primary_color: '#B9A8F5', display_face: 'imbue', short_name: '' });
assert.deepEqual(pub, { logo: null, accent: '#B9A8F5', face: 'imbue', shortName: null });
assert.deepEqual(markBrand(pub), { accent: '#B9A8F5', face: 'imbue' });
assert.equal(toPublicBrand({ logo_url: null, primary_color: 'orange', display_face: null, short_name: null }).accent, null);
assert.equal(markBrand(toPublicBrand({ logo_url: null, primary_color: 'orange', display_face: null, short_name: null })), null);
assert.equal(markBrand(null), null);

console.log('brand: ok');
