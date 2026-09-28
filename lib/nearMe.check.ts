// Checks for lib/nearMe.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import {
  areaLabel,
  areaParams,
  formatDistance,
  photonUrl,
  roundCoord,
  splitEarly,
  usesMiles,
  venueAddressesFrom,
  venueAddressFrom,
  type DiscoverRow,
} from './nearMe';

// --- areas: labels, and coordinates rounded before they leave the device ---
const me = { kind: 'point', latitude: 40.712776, longitude: -74.005974, radiusKm: 10, source: 'me' } as const;
assert.equal(areaLabel(me), 'near you');
assert.equal(areaLabel({ ...me, source: 'map' }), 'in this area');
assert.equal(areaLabel({ kind: 'city', city: 'New York', country_code: 'US', label: 'New York' }), 'in New York');
assert.equal(areaLabel({ kind: 'anywhere' }), 'anywhere');
assert.deepEqual(areaParams(me), { p_latitude: 40.713, p_longitude: -74.006, p_radius_km: 10 });
assert.deepEqual(areaParams({ kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' }), { p_city: 'Melbourne', p_country_code: 'AU' });
assert.deepEqual(areaParams({ kind: 'anywhere' }), {});
assert.equal(roundCoord(-0.0004), -0);

// --- distances ---
assert.equal(formatDistance(0.012), '50 m');
assert.equal(formatDistance(0.349), '350 m');
assert.equal(formatDistance(1.234), '1.2 km');
assert.equal(formatDistance(14.6), '15 km');
assert.equal(formatDistance(1.609344, true), '1.0 mi');
assert.equal(formatDistance(20, true), '12 mi');
assert.equal(formatDistance(0, true), '0.1 mi');

assert.equal(usesMiles({ measurementSystem: 'us', regionCode: 'AU' }), true);
assert.equal(usesMiles({ measurementSystem: 'metric', regionCode: 'US' }), false);
assert.equal(usesMiles({ measurementSystem: null, regionCode: 'US' }), true);
assert.equal(usesMiles({ measurementSystem: null, regionCode: 'AU' }), false);
assert.equal(usesMiles(undefined), false);

// --- ranked and early rows ---
const row = (over: Partial<DiscoverRow>): DiscoverRow => ({
  position: null, venue_profile_id: 'x', handle: 'x', display_name: 'X', locality: null, city: null,
  latitude: null, longitude: null, distance_km: null, score: null, rankers: 1, is_early: true, ...over,
});
const { ranked, early } = splitEarly([
  row({ venue_profile_id: 'a', position: 1, score: 9.1, is_early: false, rankers: 30 }),
  row({ venue_profile_id: 'b', rankers: 4 }),
  row({ venue_profile_id: 'c', position: 2, score: 8, is_early: false, rankers: 22 }),
]);
assert.deepEqual(ranked.map((r) => r.venue_profile_id), ['a', 'c']);
assert.deepEqual(early.map((r) => r.venue_profile_id), ['b']);

// --- Photon results as bar addresses ---
assert.equal(photonUrl('  dead rabbit & co '), 'https://photon.komoot.io/api/?q=dead%20rabbit%20%26%20co&limit=6');
const bar = venueAddressFrom({
  geometry: { type: 'Point', coordinates: [-74.0107, 40.7033] },
  properties: {
    osm_type: 'N', osm_id: 1, osm_key: 'amenity', osm_value: 'bar', name: 'Harbour Room', housenumber: '30',
    street: 'Water Street', postcode: '10004', district: 'Financial District', city: 'New York', state: 'New York', countrycode: 'us',
  },
});
assert.deepEqual(bar, {
  key: 'N1', placeName: 'Harbour Room', address_line: '30 Water Street', locality: 'Financial District', postcode: '10004',
  city: 'New York', region: 'New York', country_code: 'US', latitude: 40.7033, longitude: -74.0107,
  label: 'Harbour Room, 30 Water Street, Financial District, New York',
});
// Number after the street where people write it that way; a plain address has no place name.
const german = venueAddressFrom({
  geometry: { coordinates: [13.4, 52.5] },
  properties: { osm_type: 'W', osm_id: 2, osm_key: 'place', housenumber: '12', street: 'Torstraße', city: 'Berlin', countrycode: 'DE' },
});
assert.equal(german?.address_line, 'Torstraße 12');
assert.equal(german?.placeName, null);
// A street result carries the street as its name.
const street = venueAddressFrom({
  geometry: { coordinates: [-73.9897, 40.719] },
  properties: { osm_type: 'W', osm_id: 3, osm_key: 'highway', type: 'street', name: 'Orchard Street', district: 'Manhattan', city: 'New York', countrycode: 'US' },
});
assert.equal(street?.address_line, 'Orchard Street');
assert.equal(street?.placeName, null);
assert.equal(street?.label, 'Orchard Street, Manhattan, New York');
// Whole cities and streets with no town can't be a bar's address.
assert.equal(venueAddressFrom({ geometry: { coordinates: [1, 2] }, properties: { osm_key: 'place', name: 'Paris', city: 'Paris', countrycode: 'FR' } }), null);
assert.equal(venueAddressFrom({ geometry: { coordinates: [1, 2] }, properties: { street: 'A1', countrycode: 'FR' } }), null);
assert.equal(venueAddressFrom({ geometry: null, properties: { street: 'Main St', city: 'X', countrycode: 'US' } }), null);
// Duplicates (same OSM object) show once.
assert.equal(venueAddressesFrom({ features: [
  { geometry: { coordinates: [13.4, 52.5] }, properties: { osm_type: 'W', osm_id: 2, street: 'Torstraße', city: 'Berlin', countrycode: 'DE' } },
  { geometry: { coordinates: [13.4, 52.5] }, properties: { osm_type: 'W', osm_id: 2, street: 'Torstraße', city: 'Berlin', countrycode: 'DE' } },
] }).length, 1);
assert.deepEqual(venueAddressesFrom(null), []);

console.log('nearMe: ok');
