// Checks for lib/directions.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { addressLine, appUrl, awayFrom, geoListingUrl, geoUrl, googleMapsUrl, listingUrl, walkTime } from './directions';

const rye = { name: 'Little Rye & Co', latitude: -37.8049, longitude: 144.9822 };
assert.equal(googleMapsUrl(rye), 'https://www.google.com/maps/dir/?api=1&destination=-37.8049,144.9822');
assert.equal(appUrl('apple', rye), 'https://maps.apple.com/?daddr=-37.8049,144.9822&q=Little%20Rye%20%26%20Co');
assert.equal(appUrl('google', rye), 'comgooglemaps://?daddr=-37.8049,144.9822');
assert.equal(appUrl('waze', rye), 'waze://?ll=-37.8049,144.9822&navigate=yes');
assert.equal(geoUrl(rye), 'geo:0,0?q=-37.8049,144.9822(Little%20Rye%20%26%20Co)');

// The listing: found by name, not a route to the street address.
const listed = { ...rye, address: '42 Gertrude St, Fitzroy' };
assert.equal(listingUrl('apple', listed), 'https://maps.apple.com/?q=Little%20Rye%20%26%20Co&sll=-37.8049,144.9822');
assert.equal(listingUrl('google', listed), 'https://www.google.com/maps/search/?api=1&query=Little%20Rye%20%26%20Co%2C%2042%20Gertrude%20St%2C%20Fitzroy');
assert.equal(listingUrl('google', { ...rye, address: null }), 'https://www.google.com/maps/search/?api=1&query=-37.8049%2C144.9822', 'no street: the point');
assert.equal(geoListingUrl(listed), 'geo:-37.8049,144.9822?q=Little%20Rye%20%26%20Co%2C%2042%20Gertrude%20St%2C%20Fitzroy');

assert.equal(addressLine({ address_line: '42 Gertrude St', locality: 'Fitzroy', city: 'Melbourne' }), '42 Gertrude St, Fitzroy');
assert.equal(addressLine({ address_line: null, locality: null, city: 'Melbourne' }), 'Melbourne');
assert.equal(addressLine({ address_line: ' ', locality: null, city: null }), null);

// About 400 m north of the bar.
const me = { latitude: -37.8013, longitude: 144.9822 };
assert.equal(awayFrom(me, rye), '400 m');
assert.equal(awayFrom(null, rye), null);
assert.equal(awayFrom(me, { latitude: null, longitude: null }), null);
assert.equal(walkTime(me, rye), 'about 5 min on foot');
assert.equal(walkTime({ latitude: -33.87, longitude: 151.21 }, rye), null, 'Sydney to Melbourne is no walk');
