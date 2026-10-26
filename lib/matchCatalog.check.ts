import assert from 'node:assert/strict';

import type { CatalogItem } from './match';
import { CATALOG_RANGES, packCatalog, unpackCatalog } from './matchCatalog';

// The ranges cover every id once: each starts where the last stopped, the first at the lowest id, the last open-ended.
assert.equal(CATALOG_RANGES.length, 16);
assert.equal(CATALOG_RANGES[0].lo, '00000000-0000-0000-0000-000000000000');
CATALOG_RANGES.forEach((r, i) => assert.equal(r.hi, CATALOG_RANGES[i + 1]?.lo ?? null));
const inRange = (id: string) => CATALOG_RANGES.filter((r) => id >= r.lo && (r.hi === null || id < r.hi)).length;
for (const id of ['00000000-0000-0000-0000-000000000000', '0fffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000000', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
  assert.equal(inRange(id), 1, id);
}

// Saved and read back: the same items, kinds pointing in the list or outside it.
const items: CatalogItem[] = [
  { id: 'a', name: 'Gin', genericId: null, barId: null },
  { id: 'b', name: 'Beefeater Gin', genericId: 'a', barId: null },
  { id: 'c', name: 'Mastiha', genericId: 'not-shared', barId: null },
];
const saved = packCatalog(items, 123);
assert.deepEqual(saved.kinds, [null, 0, 'not-shared']);
assert.deepEqual(unpackCatalog(JSON.parse(JSON.stringify(saved))), { savedAt: 123, items });
// Missing, another version or broken: nothing, and it's downloaded again.
assert.equal(unpackCatalog(null), null);
assert.equal(unpackCatalog({ ...saved, v: 2 }), null);
assert.equal(unpackCatalog({ ...saved, names: ['Gin'] }), null);

console.log('matchCatalog: ok');
