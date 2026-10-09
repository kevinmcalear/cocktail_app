// Checks for lib/discoverMap.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { areaFromViewport, cameraFor, cameraForArea, dotsOf, pinLabel, pinLook, pinsFrom, movedFrom, viewportFrom } from './discoverMap';
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

// --- pin look: a scored pill, an early dot, the accent when selected ---
const accent = { fill: '#D0643B', text: '#FFFFFF' };
assert.equal(pinLook(pins[0], false, accent).label, '9.1');
assert.equal(pinLook(pins[0], false, accent).minWidth, 44);
assert.equal(pinLook(pins[0], false, accent).logo, 'https://x/a.png');
assert.equal(pinLook(pins[0], false, accent).paddingLeft, 2, 'the logo sits close to the pill edge');
assert.equal(pinLook(pins[1], false, accent).height, 18);
assert.equal(pinLook({ ...pins[1], logo: 'https://x/b.png' }, false, accent).height, 30, 'a lone logo leaves room for its ring');
assert.ok(pinLook(pins[0], false, accent).zIndex > pinLook(pins[1], false, accent).zIndex, 'a scored pin sits over an early one');
assert.ok(pinLook({ ...pins[0], score: 9.5 }, false, accent).zIndex > pinLook({ ...pins[0], score: 7.1 }, false, accent).zIndex, 'the higher score on top');
assert.ok(pinLook(pins[1], true, accent).zIndex > pinLook({ ...pins[0], score: 10 }, false, accent).zIndex, 'the selected pin over all');
assert.notEqual(pinLook(pins[0], false, accent).backgroundColor, pinLook(pins[1], false, accent).backgroundColor);
assert.equal(pinLook(pins[1], true, accent).backgroundColor, accent.fill);
assert.equal(pinLook(pins[1], true, accent).color, accent.text);
assert.equal(pinLook(pins[1], true, accent).borderColor, accent.fill);

// --- viewport from MapLibre's centre and [west, south, east, north] bounds ---
assert.deepEqual(viewportFrom({ lat: 40.72, lng: -73.99 }, [-74.01, 40.7, -73.97, 40.74], 13), {
  latitude: 40.72, longitude: -73.99, latitudeDelta: 40.74 - 40.7, longitudeDelta: -73.97 - -74.01, zoom: 13,
});

// --- camera: fits the pins, a city view for one, nothing for none ---
assert.equal(cameraFor([]), null);
const one = cameraFor([{ latitude: 40.72, longitude: -73.99 }])!;
assert.deepEqual([one.latitude, one.longitude], [40.72, -73.99]);
assert.ok(one.zoom >= 13 && one.zoom <= 15, `one pin shows its neighbourhood, got ${one.zoom}`);
const manhattan = cameraFor([{ latitude: 40.70, longitude: -74.01 }, { latitude: 40.74, longitude: -73.96 }])!;
assert.ok(manhattan.zoom > 11 && manhattan.zoom < 13.5, `a few km across, got ${manhattan.zoom}`);
const world = cameraFor([{ latitude: 40.7, longitude: -74 }, { latitude: -37.8, longitude: 144.96 }])!;
assert.equal(world.zoom, 2);

// --- a map area frames its circle; near me opens on the person's neighbourhood ---
const empty = cameraForArea({ kind: 'point', latitude: 40.72, longitude: -73.99, radiusKm: 10, source: 'map' })!;
assert.ok(Math.abs(empty.latitude - 40.72) < 1e-9 && empty.longitude === -73.99);
assert.ok(empty.zoom > 9 && empty.zoom < 12, `a 20 km circle, got ${empty.zoom}`);
const near = cameraForArea({ kind: 'point', latitude: 40.72, longitude: -73.99, radiusKm: 10, source: 'me' })!;
assert.deepEqual([near.latitude, near.longitude], [40.72, -73.99]);
assert.ok(near.zoom >= 13 && near.zoom <= 15, `near me shows the neighbourhood, got ${near.zoom}`);
assert.equal(cameraForArea({ kind: 'anywhere' }), null);

// --- search this area: half the diagonal, rounded, clamped ---
const area = areaFromViewport({ latitude: 40.7209, longitude: -73.988, latitudeDelta: 0.1, longitudeDelta: 0.1, zoom: 11 });
assert.deepEqual([area.latitude, area.longitude, area.source], [40.721, -73.988, 'map']);
// 5.55 km up, 4.21 km across (longitude shrinks at 40.7 N): 6.97 km.
assert.equal(area.radiusKm, 7);
assert.equal(areaFromViewport({ latitude: 0, longitude: 0, latitudeDelta: 0.0001, longitudeDelta: 0.0001, zoom: 20 }).radiusKm, 0.5);
assert.equal(areaFromViewport({ latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 180, zoom: 1 }).radiusKm, 200);

// --- the list follows the map: half a zoom step or a sixth of the view, not a nudge ---
const view = { latitude: 40.72, longitude: -73.99, latitudeDelta: 0.06, longitudeDelta: 0.04, zoom: 13 };
const at = { latitude: 40.72, longitude: -73.99, zoom: 13 };
assert.equal(movedFrom(null, view), true, 'nothing fit yet: any move');
assert.equal(movedFrom(at, view), false);
assert.equal(movedFrom(at, { ...view, latitude: 40.725 }), false, 'a nudge');
assert.equal(movedFrom(at, { ...view, latitude: 40.735 }), true, 'a quarter of the view up');
assert.equal(movedFrom(at, { ...view, longitude: -73.98 }), true, 'a quarter of the view across');
assert.equal(movedFrom(at, { ...view, zoom: 13.3 }), false, 'a little pinch');
assert.equal(movedFrom(at, { ...view, zoom: 12.4 }), true, 'zoomed out');
assert.equal(movedFrom({ ...at, longitude: 179.999 }, { ...view, longitude: -179.999 }), false, 'across the antimeridian is close');

console.log('discoverMap: ok');

// --- dots: the map's own layer for pins past the drawn ones, labelled like the pins, closed bars unlabelled ---
const dots = dotsOf([{ ...pins[0], drinks: 12 }, pins[1], { ...pins[1], id: 'shut', closed: 'Closed 2019' }]);
assert.deepEqual(dots.features.map((f) => f.properties), [{ id: 'a', label: '12' }, { id: 'b', label: '' }, { id: 'shut', label: '' }]);
assert.deepEqual(dots.features[0].geometry.coordinates, [144.96, -37.8]);
