// Checks for lib/discoverMap.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { AREA_ZOOM, CLOSE_ZOOM, readableLabels, areaLabel, areasFrom, BEST_PINS, cameraFor, cameraForArea, dotsOf, MAX_AREAS, pinLabel, pinLook, pinsToDraw, viewportFrom, type MapPin, type MapView } from './discoverMap';

const pin = (over: Partial<MapPin>): MapPin => ({
  id: 'x', handle: 'x', name: 'X', logo: null, place: 'Brunswick, Melbourne', latitude: -37.8, longitude: 144.96, score: null, position: null, rankers: 3, ...over,
});
const pins = [pin({ id: 'a', position: 1, score: 9.14, logo: 'https://x/a.png' }), pin({ id: 'b' })];
assert.equal(pinLabel(pins[0]), '9.1');
assert.equal(pinLabel(pins[1]), '');

// --- pin look: a scored pill, an early dot, the accent when selected ---
const accent = { fill: '#D0643B', text: '#FFFFFF' };
assert.equal(pinLook(pins[0], false, accent).label, '9.1');
assert.equal(pinLook(pins[0], false, accent).minWidth, 44);
assert.equal(pinLook(pins[0], false, accent).logo, null, 'the score alone on the pill (disc-map-opt-c), no bar logo');
assert.equal(pinLook({ ...pins[0], image: 'https://x/d.png' }, false, accent).logo, 'https://x/d.png', 'searching: the best match');
assert.equal(pinLook({ ...pins[0], image: 'https://x/d.png' }, false, accent).paddingLeft, 5, 'the picture sits 5 in from the pill edge (disc-desk-search)');
assert.equal(pinLook({ ...pins[0], top: 'Dirty Martini' }, false, accent).font, 'medium', 'a drink name in the system font, not figures');
assert.equal(pinLook({ ...pins[0], top: 'Dirty Martini' }, true, accent).height, 48);
assert.equal(pinLook(pins[1], false, accent).height, 18);
assert.equal(pinLook({ ...pins[1], image: 'https://x/b.png' }, false, accent).height, 40, 'a lone picture leaves room for its ring');
assert.ok(pinLook(pins[0], false, accent).zIndex > pinLook(pins[1], false, accent).zIndex, 'a scored pin sits over an early one');
assert.ok(pinLook({ ...pins[0], score: 9.5 }, false, accent).zIndex > pinLook({ ...pins[0], score: 7.1 }, false, accent).zIndex, 'the higher score on top');
assert.ok(pinLook(pins[1], true, accent).zIndex > pinLook({ ...pins[0], score: 10 }, false, accent).zIndex, 'the selected pin over all');
assert.notEqual(pinLook(pins[0], false, accent).backgroundColor, pinLook(pins[1], false, accent).backgroundColor);
assert.equal(pinLook(pins[1], true, accent).backgroundColor, accent.fill);
assert.equal(pinLook(pins[1], true, accent).color, accent.text);
assert.equal(pinLook(pins[1], true, accent).borderColor, accent.fill);

// --- up close: a bigger logo; the name only on the pin under the pointer ---
const logoPin = { ...pins[1], logo: 'https://x/l.png' };
assert.equal(pinLook(logoPin, false, accent, CLOSE_ZOOM - 1).label, '', 'further out, a logo pin is the logo alone');
assert.equal(pinLook(logoPin, false, accent, CLOSE_ZOOM - 1).logoSize, 36);
assert.equal(pinLook(logoPin, false, accent, CLOSE_ZOOM).label, '', 'close, the other pins stay unnamed');
assert.equal(pinLook(logoPin, false, accent, CLOSE_ZOOM).logoSize, 42, 'a size up from the 36 further out');
assert.equal(pinLook(logoPin, true, accent, CLOSE_ZOOM).label, logoPin.name);
assert.equal(pinLook(logoPin, false, accent, CLOSE_ZOOM, true).label, logoPin.name, 'hovering the pin writes its name');
assert.equal(pinLook(logoPin, true, accent, CLOSE_ZOOM).font, 'semiBold');
assert.equal(pinLook(pins[0], false, accent, CLOSE_ZOOM).label, '9.1', 'a score stays, without the bar');
assert.equal(pinLook(pins[0], true, accent, CLOSE_ZOOM).label, `9.1 · ${pins[0].name}`, 'the hovered score pin keeps its score before the name');
assert.equal(pinLook({ ...logoPin, name: 'The Exceptionally Long Bar Name' }, true, accent, 17).label.length, 18, 'long names cut as drink names are');
assert.equal(pinLook({ ...pins[0], top: 'Dirty Martini' }, false, accent, CLOSE_ZOOM).label, 'Dirty Martini', 'searching: the drink, not the bar');

// --- Discover's map: a bar's mark on its colour, its name beside it when named, no score ---
const mark = { edge: '#111111', ink: '#EEEEEE', family: 'Serif' };
const marked = pin({ name: 'little rye', score: 9.1, mark, brand: { accent: '#D0643B', face: 'besley' } });
assert.equal(pinLook(marked, false, accent).label, 'L', 'its letter, not its score');
assert.equal(pinLook(marked, false, accent).family, 'Serif');
assert.equal(pinLook(marked, false, accent).borderColor, '#111111');
assert.equal(pinLook(marked, false, accent).beside, null);
assert.equal(pinLook({ ...marked, named: true }, false, accent).beside?.name, 'little rye');
assert.equal(pinLook(marked, true, accent).beside?.name, 'little rye', 'the row in hand names its bar');
assert.equal(pinLook(pin({ logo: 'https://x/l.png', mark }), false, accent).label, '', 'a logo says it');
assert.equal(pinLook({ ...marked, closed: 'Closed 2019' }, false, accent).family, null, 'a closed bar is not marked');

// --- the dark map's street names are readable; the light one is left as it is ---
const style = { version: 8, sources: {}, layers: [{ id: 'highway_name_other', type: 'symbol', source: 's', layout: { 'text-size': 10 }, paint: { 'text-color': 'rgba(80, 78, 78, 1)' } }, { id: 'water', type: 'fill', source: 's' }] } as Parameters<typeof readableLabels>[0];
const road = readableLabels(style, 'dark').layers[0] as { paint: Record<string, unknown> };
assert.notEqual(road.paint['text-color'], 'rgba(80, 78, 78, 1)');
assert.equal(readableLabels(style, 'dark').layers[1], style.layers[1]);
assert.equal(readableLabels(style, 'light'), style);

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
// Found, near me centres on the person, not the snapped area a kilometre off.
const me = { latitude: 40.7261, longitude: -73.9807 };
assert.deepEqual(cameraForArea({ kind: 'point', latitude: 40.72, longitude: -73.99, radiusKm: 10, source: 'me' }, me), { ...me, zoom: near.zoom });
assert.equal(cameraForArea({ kind: 'point', latitude: 40.72, longitude: -73.99, radiusKm: 10, source: 'map' }, me)!.latitude, empty.latitude);

console.log('discoverMap: ok');

// --- dots: every bar in the map's own layer, a plain dot; the score (or -1) feeds an area's best ---
const dots = dotsOf([{ ...pins[0], drinks: 12 }, { ...pins[1], drinks: 3 }, { ...pins[0], id: 'shut', closed: 'Closed 2019' }]);
assert.deepEqual(dots.features.map((f) => f.properties), [{ id: 'a', score: 9.14, closed: false }, { id: 'b', score: -1, closed: false }, { id: 'shut', score: -1, closed: true }]);
assert.deepEqual(dots.features[0].geometry.coordinates, [144.96, -37.8]);

// --- which bars become pins at a zoom (options C and D, 13 Oct) ---
// A 20 x 20 grid of bars around (0, 0), scores 0.0 to 9.9 by index, every fifth unscored.
const grid = Array.from({ length: 400 }, (_, i) => ({
  ...pins[0], id: `g${i}`, latitude: Math.floor(i / 20) * 0.01 - 0.1, longitude: (i % 20) * 0.01 - 0.1,
  score: i % 5 === 0 ? null : (i % 100) / 10, logo: null,
}));
const wide: MapView = { bounds: [-0.2, -0.2, 0.2, 0.2], zoom: AREA_ZOOM };
const drawn = pinsToDraw(grid, wide, null);
assert.equal(drawn.length, BEST_PINS, 'up close: the best few in view, no more');
assert.ok(drawn.every((p) => p.score !== null), 'unscored bars stay dots');
assert.deepEqual(drawn.map((p) => p.score), [...drawn.map((p) => p.score!)].sort((a, b) => b - a), 'best first');
const worst = Math.min(...drawn.map((p) => p.score!));
assert.ok(grid.filter((p) => p.score !== null && p.score > worst).every((p) => drawn.includes(p)), 'no better bar left as a dot');
// Zoom in on one corner: different, lesser bars there are promoted to pins, still about ten.
const corner: MapView = { bounds: [-0.1, -0.1, -0.03, -0.03], zoom: AREA_ZOOM + 2 };
const close = pinsToDraw(grid, corner, null);
assert.equal(close.length, BEST_PINS);
assert.ok(close.every((p) => p.latitude <= -0.03 && p.longitude <= -0.03), 'only bars in view');
assert.ok(close.some((p) => !drawn.includes(p)), 'zooming in promotes dots to pins');
// Fewer scored bars in view than BEST_PINS: all of them, no padding.
assert.equal(pinsToDraw(grid, { bounds: [-0.1, -0.1, -0.085, -0.085], zoom: 16 }, null).length, 2);
// No scores yet (prod, 13 Oct): the busiest bars in view with a logo fill the pins, logo alone; logo-less ones stay dots.
const early = grid.map((p, i) => ({ ...p, score: null, drinks: i, logo: i % 2 ? `https://x/${i}.png` : null }));
const known = pinsToDraw(early, wide, null);
assert.equal(known.length, BEST_PINS);
assert.ok(known.every((p) => p.logo), 'only bars with a logo');
assert.deepEqual(known.map((p) => p.drinks), [399, 397, 395, 393, 391, 389, 387, 385, 383, 381], 'busiest first');
// On Top bars (loved, then most relevant): that order wins over drink counts, and the rest follow, busiest first.
const ordered = pinsToDraw(early.map((p) => (p.id === 'g1' ? { ...p, order: 1 } : p.id === 'g3' ? { ...p, order: 0 } : p)), wide, null);
assert.deepEqual(ordered.slice(0, 3).map((p) => p.id), ['g3', 'g1', 'g399']);
assert.equal(pinLook(known[0], false, accent).logo, known[0].logo);
assert.equal(pinLook(known[0], false, accent).height, 40);
assert.equal(pinLook(known[0], false, accent).label, '');
assert.equal(pinsToDraw([pin({ id: 'm', mark })], null, null).length, 1, 'a marked bar is a pin with no logo');
// Scored bars come first; logos only fill what's left.
const mixed = pinsToDraw(early.map((p, i) => (i < 3 ? { ...p, score: 8 } : p)), wide, null);
assert.deepEqual(mixed.slice(0, 3).map((p) => p.score), [8, 8, 8]);
assert.equal(mixed.length, BEST_PINS);
// A picked score pin is a size up (disc-desk-browse).
assert.equal(pinLook(pins[0], true, accent).height, 36);
assert.equal(pinLook(pins[0], true, accent).minWidth, 56);
// Zoomed out: areas instead, so no score pins; the selected and named search pins stay.
assert.deepEqual(pinsToDraw(grid, { ...wide, zoom: AREA_ZOOM - 0.1 }, null), []);
const named = grid.map((p) => (p.id === 'g7' ? { ...p, top: 'Martini' } : p));
assert.deepEqual(pinsToDraw(named, { ...wide, zoom: 9 }, 'g0').map((p) => p.id), ['g0', 'g7']);
// Up close the selected bar is a pin even off the best list or out of view, and never twice.
const sel = pinsToDraw(grid, corner, 'g399');
assert.equal(sel[0].id, 'g399');
assert.equal(sel.length, BEST_PINS + 1);
assert.equal(pinsToDraw(grid, wide, drawn[0].id).length, BEST_PINS);
// Closed bars are never score pins; before the map says what it shows, the best anywhere.
assert.ok(pinsToDraw(grid.map((p) => ({ ...p, closed: 'Closed 2019' })), wide, null).length === 0);
assert.equal(pinsToDraw(grid, null, null)[0].score, 9.9);
// Across the antimeridian.
assert.equal(pinsToDraw([{ ...pins[0], longitude: 179.9 }, { ...pins[0], id: 'e', longitude: -179.9 }, { ...pins[0], id: 'far', longitude: 0 }], { bounds: [179, -40, -179, -30], zoom: 14 }, null).length, 2);

// --- area labels, read back from MapLibre's clusters ---
assert.equal(areaLabel(9.14, 24), '9.1 · 24 bars');
assert.equal(areaLabel(-1, 5), '5 bars', 'no scored bar yet');
assert.equal(areaLabel(8, 1), '8.0 · 1 bar');
const cluster = (id: number, best: number, count: number): GeoJSON.Feature => ({ type: 'Feature', properties: { cluster: true, cluster_id: id, best, point_count: count }, geometry: { type: 'Point', coordinates: [1, 2] } });
const areas = areasFrom([cluster(1, 9.1, 24), cluster(1, 9.1, 24), cluster(2, -1, 3), { type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Point', coordinates: [0, 0] } }], null);
assert.deepEqual(areas, [{ id: 1, latitude: 2, longitude: 1, label: '9.1 · 24 bars' }, { id: 2, latitude: 2, longitude: 1, label: '3 bars' }], 'one per cluster, plain bars left out');
assert.equal(areasFrom(Array.from({ length: 100 }, (_, i) => cluster(i, 5, 2)), null).length, MAX_AREAS);
assert.deepEqual(areasFrom([cluster(1, 9, 2)], { bounds: [5, 5, 6, 6], zoom: 9 }), [], 'out of view');
assert.deepEqual(areasFrom([cluster(1, 9, 2)], { bounds: [0, 0, 3, 3], zoom: AREA_ZOOM }), [], 'up close there are no areas');
assert.equal(areasFrom([cluster(1, 9, 2)], { bounds: [0, 0, 3, 3], zoom: AREA_ZOOM - 1 }).length, 1);
