import assert from 'node:assert/strict';

import { CATALOG_RANGES, packCatalog, shortlistCatalog, toItems, unpackCatalog, type CatalogRow } from './matchCatalog';

// The ranges cover every id once: each starts where the last stopped, the first at the lowest id, the last open-ended.
assert.equal(CATALOG_RANGES.length, 16);
assert.equal(CATALOG_RANGES[0].lo, '00000000-0000-0000-0000-000000000000');
CATALOG_RANGES.forEach((r, i) => assert.equal(r.hi, CATALOG_RANGES[i + 1]?.lo ?? null));
const inRange = (id: string) => CATALOG_RANGES.filter((r) => id >= r.lo && (r.hi === null || id < r.hi)).length;
for (const id of ['00000000-0000-0000-0000-000000000000', '0fffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000000', '7c9e6679-7425-40de-944b-e07fc1f90ae7', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
  assert.equal(inRange(id), 1, id);
}

// Saved and read back: the same rows, kinds pointing in the list or outside it.
const row = (id: string, name: string, generic: string | null = null, extra: Partial<CatalogRow> = {}): CatalogRow => ({
  id, name, generic_id: generic, bar_id: null, hide_from_search: false, ingredient_role: null, brand_maker: null, description: null, ...extra,
});
const rows = [row('a', 'Gin', null, { description: 'Juniper.' }), row('b', 'Beefeater Gin', 'a', { ingredient_role: 'product', brand_maker: 'Beefeater' }), row('c', 'Mastiha', 'not-shared', { hide_from_search: true })];
const saved = packCatalog(rows, 123);
assert.deepEqual(saved.kinds, [null, 0, 'not-shared']);
assert.deepEqual(saved.hidden, [2]);
assert.deepEqual(unpackCatalog(JSON.parse(JSON.stringify(saved))), { savedAt: 123, rows });
// The matcher's view of them.
assert.deepEqual(toItems([...rows, row('n', '')]).map((i) => [i.id, i.genericId]), [['a', null], ['b', 'a'], ['c', 'not-shared']]);
// Missing, another version (v1 held names only) or broken: nothing, and it's downloaded again.
assert.equal(unpackCatalog(null), null);
assert.equal(unpackCatalog({ ...saved, v: 1 }), null);
assert.equal(unpackCatalog({ ...saved, names: ['Gin'] }), null);
assert.equal(unpackCatalog({ ...saved, descriptions: undefined }), null);

// The server's shortlist: each row once, shared then the venue's own, each by name; aliases from the rows that came by one.
const hit = (id: string, name: string, bar: string | null = null, alias: string | null = null) => ({ id, name, generic_id: null, bar_id: bar, kind_of: 0, alias });
const short = shortlistCatalog([hit('v', 'Beefeater Gin', 'bar-1'), hit('b', 'Beefeater Gin'), hit('a', 'Gin'), hit('b', 'Beefeater Gin', null, 'beefeater'), hit('s', 'Simple syrup', null, '1:1 sugar syrup')]);
assert.deepEqual(short.catalog.map((i) => i.id), ['b', 'a', 's', 'v']);
assert.deepEqual(short.aliases, [{ key: 'beefeater', item_id: 'b' }, { key: '1:1 sugar syrup', item_id: 's' }]);

console.log('matchCatalog: ok');
