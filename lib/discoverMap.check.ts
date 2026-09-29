// Checks for lib/discoverMap.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { areaFromViewport, cameraFor, cameraForArea, pinLabel, pinsFrom } from './discoverMap';
import type { DiscoverRow } from './nearMe';

const row = (over: Partial<DiscoverRow>): DiscoverRow => ({
  position: null, venue_profile_id: 'x', handle: 'x', display_name: 'X', locality: 'Brunswick', city: 'Melbourne',
  latitude: -37.8, longitude: 144.96, distance_km: null, score: null, rankers: 3, is_early: true, ...over,
});

// --- pins: ranked then early, rows without coordinates left off ---
const pins = pinsFrom({
  ranked: [row({ venue_profile_id: 'a', position: 1, score: 9.14, is_early: false, avatar_url: 'https://x/a.png' })],
  early: [row({ venue_profile_id: 'b' }), row({ venue_profile_id: 'c', latitude: null, longitude: null })],
});
assert.deepEqual(pins.map((p) => [p.id, p.position, p.score]), [['a', 1, 9.14], ['b', null, null]]);
assert.equal(pins[0].place, 'Brunswick, Melbourne');
assert.deepEqual(pins.map((p) => p.logo), ['https://x/a.png', null]);
assert.equal(pinLabel(pins[0]), '9.1');
assert.equal(pinLabel(pins[1]), '');
assert.deepEqual(pinsFrom(undefined), []);

// --- camera: fits the pins, a city view for one, nothing for none ---
assert.equal(cameraFor([]), null);
const one = cameraFor([{ latitude: 40.72, longitude: -73.99 }])!;
assert.deepEqual([one.latitude, one.longitude], [40.72, -73.99]);
assert.ok(one.zoom >= 13 && one.zoom <= 15, `one pin shows its neighbourhood, got ${one.zoom}`);
const manhattan = cameraFor([{ latitude: 40.70, longitude: -74.01 }, { latitude: 40.74, longitude: -73.96 }])!;
assert.ok(manhattan.zoom > 11 && manhattan.zoom < 13.5, `a few km across, got ${manhattan.zoom}`);
const world = cameraFor([{ latitude: 40.7, longitude: -74 }, { latitude: -37.8, longitude: 144.96 }])!;
assert.equal(world.zoom, 2);

// --- an empty area still frames its circle ---
const empty = cameraForArea({ kind: 'point', latitude: 40.72, longitude: -73.99, radiusKm: 10, source: 'me' })!;
assert.ok(Math.abs(empty.latitude - 40.72) < 1e-9 && empty.longitude === -73.99);
assert.ok(empty.zoom > 9 && empty.zoom < 12, `a 20 km circle, got ${empty.zoom}`);
assert.equal(cameraForArea({ kind: 'anywhere' }), null);

// --- search this area: half the diagonal, rounded, clamped ---
const area = areaFromViewport({ latitude: 40.7209, longitude: -73.988, latitudeDelta: 0.1, longitudeDelta: 0.1 });
assert.deepEqual([area.latitude, area.longitude, area.source], [40.721, -73.988, 'map']);
// 5.55 km up, 4.21 km across (longitude shrinks at 40.7 N): 6.97 km.
assert.equal(area.radiusKm, 7);
assert.equal(areaFromViewport({ latitude: 0, longitude: 0, latitudeDelta: 0.0001, longitudeDelta: 0.0001 }).radiusKm, 0.5);
assert.equal(areaFromViewport({ latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 180 }).radiusKm, 200);

console.log('discoverMap: ok');
