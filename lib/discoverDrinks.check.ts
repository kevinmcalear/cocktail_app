// Checks for lib/discoverDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { barInArea, distanceKm, drinkPins, filterDrinks, findBars, kindsTitle, toDiscoverDrink, type DiscoverBar } from './discoverDrinks';

const bar = (id: string, name: string, city: string | null, lat: number | null, lng: number | null, locality: string | null = null): DiscoverBar => ({
  id,
  handle: id,
  name,
  logo: null,
  locality,
  city,
  countryCode: 'US',
  latitude: lat,
  longitude: lng,
});

const dante = bar('dante', 'Dante', 'New York', 40.7309, -74.0021, 'West Village');
const attaboy = bar('attaboy', 'Attaboy', 'New York', 40.7196, -73.9899);
const nomad = bar('nomad', 'Nomad', 'Los Angeles', 34.0452, -118.2519);
const nowhere = bar('nowhere', 'No Address', 'New York', null, null);
const bars = new Map([dante, attaboy, nomad, nowhere].map((b) => [b.id, b]));

const drink = (id: string, name: string, barId: string, ingredients: string[] = [], description = '', riffOf: string | null = null, imageUrl: string | null = null) =>
  toDiscoverDrink({ id, name, description, ingredients, riffOf, imageUrl, barId });

const drinks = [
  drink('1', 'Garibaldi', 'dante', ['Campari', 'Orange Juice']),
  drink('2', 'Negroni Sbagliato', 'dante', ['Campari', 'Sweet Vermouth', 'Prosecco'], '', 'Sbagliato', 'x.jpg'),
  drink('3', 'Penicillin', 'attaboy', ['Blended Scotch', 'Lemon Juice', 'Honey', 'Ginger'], '', 'Penicillin'),
  drink('4', 'Gimlet', 'nomad', ['Gin', 'Lime Cordial']),
  drink('5', 'Mystery', 'nowhere', [], 'A gin drink from the menu'),
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

// --- distance and areas ---
assert.ok(Math.abs(distanceKm({ latitude: 40.7309, longitude: -74.0021 }, { latitude: 40.7196, longitude: -73.9899 }) - 1.6) < 0.2, 'Dante to Attaboy is about 1.6 km');
const nearDante = { kind: 'point' as const, latitude: 40.73, longitude: -74.0, radiusKm: 1, source: 'me' as const };
assert.ok(barInArea(dante, nearDante));
assert.ok(!barInArea(attaboy, nearDante));
assert.ok(!barInArea(nowhere, nearDante), 'a bar with no coordinates is never near');
assert.ok(barInArea(nowhere, { kind: 'city', city: 'new york', country_code: 'US', label: 'New York' }), 'but it is in its city');
assert.ok(!barInArea(nomad, { kind: 'city', city: 'New York', country_code: 'US', label: 'New York' }));

// --- filtering: style, spirit, search words (bar names too), area ---
const anywhere = { kind: 'anywhere' as const };
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['negroni'], search: '', area: anywhere })), ['2']);
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['gin'], search: '', area: anywhere })).sort(), ['4', '5']);
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: [], search: 'campari dante', area: anywhere })), ['2', '1'], 'every word matches, pictures first');
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: [], search: 'attaboy', area: anywhere })), ['3'], 'a bar name finds its drinks');
// A drink on a menu now comes before a past one, even one with a picture; past drinks are still found.
const past = { ...drink('6', 'Plum Negroni', 'dante', ['Campari'], '', null, 'p.jpg'), menu: { onNow: false, past: 'Past · Mar 2024 to Jan 2025', order: 2 } };
const onNow = { ...drink('7', 'Negroni', 'dante', ['Campari']), menu: { onNow: true, past: null, order: 0 } };
assert.deepEqual(ids(filterDrinks([past, onNow], bars, { kinds: [], search: 'negroni', area: anywhere })), ['7', '6']);
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['sour'], search: '', area: nearDante })), [], 'the Penicillin is too far');
assert.deepEqual(
  ids(filterDrinks(drinks.map((d) => (d.id === '1' ? { ...d, notes: ['bitter', 'fruity'] } : d)), bars, { kinds: ['note:bitter'], search: '', area: anywhere })),
  ['1'],
  'a tasting note keeps drinks that fairly taste of it',
);
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: [], search: 'penicillin', area: anywhere })), ['3']);

// --- several filters: any within a group, every group ---
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['negroni', 'sour'], search: '', area: anywhere })).sort(), ['2', '3', '4'], 'Negronis or sours');
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['gin', 'whiskey'], search: '', area: anywhere })).sort(), ['3', '4', '5'], 'gin or whiskey');
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['sour', 'gin'], search: '', area: anywhere })), ['4'], 'a sour made with gin: the Gimlet');
assert.deepEqual(ids(filterDrinks(drinks, bars, { kinds: ['sour', 'whiskey'], search: '', area: anywhere })), ['3'], 'the Penicillin is both');
assert.equal(kindsTitle([]), 'Drinks');
assert.equal(kindsTitle(['martini', 'gin']), 'Martinis & Gin');
assert.equal(kindsTitle(['martini', 'gin', 'note:smoky']), 'Drinks, 3 filters');

// --- bars: name first, then place ---
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'da')), ['dante']);
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'west vil')), ['dante'], 'by neighbourhood');
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'new york')), ['attaboy', 'dante'], 'by city, A to Z');
assert.deepEqual(findBars([dante], 'd'), [], 'one letter finds nothing');

// --- pins: one per bar with coordinates, most drinks first ---
const pins = drinkPins(drinks, bars);
assert.deepEqual(pins.map((p) => [p.id, p.drinks]), [['dante', 2], ['attaboy', 1], ['nomad', 1]]);

// --- names that start with a symbol or number sort after letters ---
const odd = [drink('a', '&thesea', 'dante'), drink('b', '1986', 'dante'), drink('c', 'Zombie', 'dante')];
assert.deepEqual(ids(filterDrinks(odd, bars, { kinds: [], search: '', area: anywhere })), ['c', 'a', 'b']);
assert.deepEqual(ids(findBars([bar('o', 'Origin Bar', null, null, null), bar('g', 'Bar Orchard Ginza', null, null, null)], 'gin')), ['g'], 'a word must start with it');
