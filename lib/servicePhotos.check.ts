import assert from 'node:assert/strict';
import { serviceShots, shotCaption, shotList } from './servicePhotos';

const hero = { id: 'h', angle: 'hero' as const, is_generated: false, images: { url: 'hero.jpg' } };
const side = { id: 's', angle: 'side' as const, is_generated: false, images: { url: 'side.jpg' } };
const oldTop = { id: 't1', angle: 'top' as const, is_generated: false, outdated_since: '2026-09-28T00:00:00Z', images: { url: 'top-old.jpg' } };
const garnishSketch = { id: 'g', angle: 'garnish' as const, is_generated: true, images: { url: 'garnish.png' } };
const broken = { id: 'x', angle: 'handoff' as const, is_generated: false, images: null };

const shots = serviceShots([hero, side, oldTop, garnishSketch, broken]);

// Always the four service angles, in shot-list order; the hero is never one.
assert.deepEqual(shots.map((s) => s.angle), ['side', 'top', 'garnish', 'handoff']);
assert.deepEqual(shots.map((s) => s.status), ['photo', 'outdated', 'sketch', 'missing']);
assert.equal(shots[0].picture?.url, 'side.jpg');

// The shot list is everything that still needs a real, current photo.
assert.deepEqual(shotList(shots).map((s) => s.angle), ['top', 'garnish', 'handoff']);

// A new photo replaces the angle's old photos, never its sketches.
assert.deepEqual(shots[1].photoLinkIds, ['t1']);
assert.deepEqual(shots[2].photoLinkIds, []);

// A current photo wins over an outdated one and a sketch.
const newTop = { id: 't2', angle: 'top' as const, is_generated: false, images: { url: 'top-new.jpg' } };
const top = serviceShots([oldTop, newTop, { ...garnishSketch, angle: 'top' as const }])[1];
assert.equal(top.picture?.url, 'top-new.jpg');
assert.equal(top.status, 'photo');

// Labels are words, not colours.
assert.deepEqual(shots.map(shotCaption), ['Side', 'Top: may be out of date', 'Garnish: sketch, no photo yet', 'Hand-off: no photo yet']);

// No links at all: four empty tiles, all on the shot list.
assert.equal(shotList(serviceShots(undefined)).length, 4);

console.log('servicePhotos.check: ok');
