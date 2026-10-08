// Checks for lib/discoverTiles.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { inBox, parentTiles, tileBox, tileLevel, tilesFor } from './discoverTiles';

// A phone over lower Manhattan (about 0.1 degrees wide) gets level 11 tiles; a continent, level 2.
const manhattan = { latitude: 40.72, longitude: -73.99, latitudeDelta: 0.12, longitudeDelta: 0.08 };
assert.equal(tileLevel(manhattan), 11);
assert.equal(tileLevel({ ...manhattan, longitudeDelta: 2 }), 5);
assert.equal(tileLevel({ ...manhattan, longitudeDelta: 60 }), 2);
assert.equal(tileLevel({ ...manhattan, longitudeDelta: 400 }), 2, 'wider than the world is the coarsest level');

// At most 2 by 2, the middle one first, and together they cover the view.
const tiles = tilesFor(manhattan);
assert.ok(tiles.length >= 1 && tiles.length <= 4);
const middle = tileBox(tiles[0]);
assert.ok(inBox({ latitude: manhattan.latitude, longitude: manhattan.longitude }, middle), 'the first tile holds the middle');
for (const corner of [
  [manhattan.latitude + 0.06, manhattan.longitude - 0.04],
  [manhattan.latitude - 0.06, manhattan.longitude + 0.04],
]) {
  assert.ok(tiles.some((t) => inBox({ latitude: corner[0], longitude: corner[1] }, tileBox(t))), 'every corner is covered');
}

// Boxes line up with the levels above them.
const t = tiles[0];
const parents = parentTiles(t);
assert.deepEqual(parents.map((p) => p.z), [8, 5, 2]);
for (const p of parents) {
  const outer = tileBox(p);
  const inner = tileBox(t);
  assert.ok(outer.west <= inner.west && outer.east >= inner.east && outer.south <= inner.south && outer.north >= inner.north, `level ${p.z} holds it`);
}
assert.deepEqual(tileBox({ z: 2, x: 0, y: 0 }).west, -180);
assert.ok(!inBox({ latitude: null, longitude: 0 }, tileBox({ z: 2, x: 2, y: 1 })), 'no coordinates, in no tile');

console.log('discoverTiles: ok');
