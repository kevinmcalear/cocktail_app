// Checks for lib/googleTakeout.ts. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { coordsInUrl, csvRows, matchPlaces, nameMatch, readTakeout, type BarCandidate, type SavedPlace } from './googleTakeout';

const sample = (name: string) => readFileSync(join(__dirname, 'fixtures/google-takeout', name), 'utf8');
const places = (text: string): SavedPlace[] => {
  const read = readTakeout(text);
  assert.ok(read.ok, read.ok ? '' : read.reason);
  return read.places;
};

// --- Saved Places.json (Maps (your places)) ---
const saved = places(sample('Saved Places.json'));
// The unnamed dropped pin is skipped; 0,0 means Google couldn't place it.
assert.equal(saved.length, 6);
assert.deepEqual(saved[0], { name: 'Bar Margaux', latitude: -37.81071, longitude: 144.96921, address: 'Basement, 123 Example Lane, Melbourne VIC 3000, Australia' });
assert.deepEqual(saved.find((p) => p.name === 'Bar Spontana'), { name: 'Bar Spontana', latitude: null, longitude: null, address: 'Brunswick VIC 3056, Australia' });

// The older export: Title, and Location with Business Name and Geo Coordinates as strings.
const old = places(
  JSON.stringify({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Bar Olo', 'Google Maps URL': 'http://maps.google.com/?cid=1', Location: { Address: 'Carlton VIC', 'Business Name': 'Bar Olo', 'Geo Coordinates': { Latitude: '-37.79634', Longitude: '144.97488' } } } },
      { type: 'Feature', properties: { Location: { 'Business Name': 'Babines' }, 'Google Maps URL': 'https://www.google.com/maps/search/-37.80526,+144.98341' } },
    ],
  }),
);
assert.deepEqual(old, [
  { name: 'Bar Olo', latitude: -37.79634, longitude: 144.97488, address: 'Carlton VIC' },
  { name: 'Babines', latitude: -37.80526, longitude: 144.98341, address: null },
]);

// --- a saved list's CSV (Saved) ---
const list = places(sample('Want to go.csv'));
assert.deepEqual(
  list.map((p) => [p.name, p.latitude, p.longitude]),
  [
    ['Bar Bellamy', null, null],
    ['Babines', -37.80526, 144.98341],
    ['Example Wine Room', null, null],
  ],
);
assert.deepEqual(csvRows('a,"b, ""c""\nd",e\r\nf'), [['a', 'b, "c"\nd', 'e'], ['f']]);

// --- files that aren't these ---
assert.equal(readTakeout('').ok, false);
assert.equal(readTakeout('{"type":"FeatureCollection"').ok, false, 'broken JSON');
assert.equal(readTakeout('{"hello":1}').ok, false, 'JSON with no features');
assert.equal(readTakeout('Name,Amount\nGin,30').ok, false, 'a CSV with no Title column');
assert.equal(readTakeout('Title,Note,URL\n,,').ok, false, 'no named places');
assert.equal(readTakeout('﻿Title,URL\nBabines,').ok, true, 'a byte order mark');

// --- points in links ---
assert.deepEqual(coordsInUrl('https://www.google.com/maps/place/X/@-37.8,144.9,17z/data=!3d-37.81!4d144.91'), { latitude: -37.81, longitude: 144.91 }, 'the place pin over the camera');
assert.deepEqual(coordsInUrl('http://maps.google.com/?q=-37.80002,144.98001'), { latitude: -37.80002, longitude: 144.98001 });
assert.deepEqual(coordsInUrl('https://maps.google.com/?q=51.5%2C-0.12'), { latitude: 51.5, longitude: -0.12 });
assert.equal(coordsInUrl('http://maps.google.com/?cid=123'), null);
assert.equal(coordsInUrl('http://maps.google.com/?q=95.1,10.2'), null, 'off the globe');

// --- names ---
assert.equal(nameMatch('The Black Pearl Bar', 'Black Pearl'), 'same');
assert.equal(nameMatch('Bar Ampère', 'Bar Ampere'), 'same');
assert.equal(nameMatch('Arbory Bar & Eatery', 'Arbory Bar and Eatery'), 'same');
assert.equal(nameMatch("Back Alley Sally's", 'Back Alley Sallys'), 'same');
assert.equal(nameMatch('Little Rye - Cocktail Bar', 'Little Rye'), 'same');
assert.equal(nameMatch('Rye', 'Little Rye'), 'part');
assert.equal(nameMatch('Bar Olo', 'Bar Ola'), null, 'near-duplicate names are different bars');
assert.equal(nameMatch('Bar', 'Bar Olo'), null, 'filler alone matches nothing');
assert.equal(nameMatch('The Bar', 'The Bar'), 'same', 'a name that is only filler still matches itself');

// --- matching ---
const bar = (id: string, display_name: string, latitude: number | null, longitude: number | null, locality: string | null, city = 'Melbourne'): BarCandidate => ({ id, display_name, latitude, longitude, locality, city });
const bars = [
  bar('margaux', 'Bar Margaux', -37.81051, 144.96914, 'Melbourne CBD'),
  bar('pearl', 'Black Pearl', -37.79807, 144.97875, 'Fitzroy'),
  bar('ampere', 'Bar Ampere', -37.81367, 144.96741, 'Melbourne CBD'),
  bar('olo', 'Bar Olo', -37.79634, 144.97488, 'Carlton'),
  bar('ola', 'Bar Ola', -37.7999, 144.97489, 'Carlton'),
  bar('spontana', 'Bar Spontana', -37.77313, 144.96035, 'Brunswick'),
  bar('bellamy', 'Bar Bellamy', null, null, 'Carlton'),
  bar('babines', 'Babines', -37.80526, 144.98341, 'Collingwood'),
  bar('babines-syd', 'Babines', -33.87, 151.21, null, 'Sydney'),
];
const { matches, count } = matchPlaces([...saved, ...list], bars);
const got = Object.fromEntries(matches.map((m) => [m.bar.id, m.sure]));
assert.deepEqual(got, {
  // Same name within 150 m: ticked.
  margaux: true,
  pearl: true,
  ampere: true,
  babines: true,
  // Same name about 400 m off: shown, not ticked. Bar Ola sits right on the
  // saved point but is a different bar.
  olo: false,
  // No point: the name, in the address's suburb.
  spontana: false,
  // No point on either side and no address: the one bar of that name.
  bellamy: false,
});
assert.equal(count, 7, 'the market and Example Wine Room are not bars we know');
assert.ok(matches.slice(0, 4).every((m) => m.sure), 'ticked ones first');
assert.equal(matches.find((m) => m.bar.id === 'pearl')?.savedAs, 'The Black Pearl Bar');

// The same bar saved twice is one row, the surer one.
const twice = matchPlaces([{ name: 'Babines', latitude: null, longitude: null, address: null }, list[1]], bars.slice(7, 8)).matches;
assert.deepEqual(
  twice.map((m) => [m.bar.id, m.sure]),
  [['babines', true]],
);

// A name with no point and too many bars of that name says nothing.
const chain = Array.from({ length: 4 }, (_, i) => bar(`c${i}`, 'Chain Bar Co', null, null, null, `City ${i}`));
assert.equal(matchPlaces([{ name: 'Chain Bar Co', latitude: null, longitude: null, address: null }], chain).matches.length, 0);
// ...unless the address names its city.
assert.deepEqual(
  matchPlaces([{ name: 'Chain Bar Co', latitude: null, longitude: null, address: '1 Main St, City 2' }], chain).matches.map((m) => m.bar.id),
  ['c2'],
);
// A name in the address isn't a word inside another word.
assert.equal(matchPlaces([{ name: 'Babines', latitude: null, longitude: null, address: 'Sydneyside' }], [bar('s', 'Babines', null, null, null, 'Sydney'), bar('t', 'Babines', null, null, null, 'Perth')]).matches.length, 0);

console.log('googleTakeout ok');
