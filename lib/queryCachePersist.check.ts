// Checks for lib/queryCachePersist.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { dehydrate, QueryClient } from '@tanstack/react-query';

import { guardStorage, serializeCache, shouldPersistQuery } from './queryCachePersist';

// --- which queries are saved ---
const client = new QueryClient();
const build = (queryKey: unknown[], persist?: boolean) =>
  client.getQueryCache().build(client, { queryKey, meta: persist === undefined ? undefined : { persist } });
build(['dropdowns_v7', 'ingredients'], false).setData([]);
build(['dropdowns_v7', 'specs'], true).setData({});
build(['dropdowns_v7', 'current_menu_drinks', 'with-glass', ['m1']], true).setData([1]);
build(['discover-rankings', 'near'], false).setData([1]);
build(['cocktail', 'c1', null]).setData({ id: 'c1' });
build(['cocktails', [], null]).setData([1]);
build(['bars', 'u1']).setData([1]);
build(['profile', 'mine', 'u1']).setData({});
build(['profile', 'someone', 'u1']).setData({});
build(['menus-v2', 'venue-2', 'b1', 'u1']).setData([]);
build(['menus-v2', 'detail', 'm1']).setData({});
build(['item-sketch', 'c1']).setData({});
build(['bars', 'denied'], false).setData([1]);
build(['still-loading']);

const saved = dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((q) => q.queryHash);
assert.deepEqual(saved.sort(), [
  '["bars","u1"]',
  '["cocktail","c1",null]',
  '["dropdowns_v7","current_menu_drinks","with-glass",["m1"]]',
  '["dropdowns_v7","specs"]',
  '["menus-v2","venue-2","b1","u1"]',
  '["profile","mine","u1"]',
], 'only the allowlist and meta.persist true; persist false always wins');

// --- size guard drops the largest queries first ---
const persisted = (sizes: Record<string, number>) => ({
  timestamp: 1,
  buster: '',
  clientState: {
    mutations: [],
    queries: Object.entries(sizes).map(([key, n]) => ({
      queryKey: [key],
      queryHash: `["${key}"]`,
      state: { data: 'x'.repeat(n) },
    })),
  },
});
const keysOf = (json: string) =>
  (JSON.parse(json) as { clientState: { queries: { queryKey: string[] }[] } }).clientState.queries.map((q) => q.queryKey[0]);

const small = persisted({ a: 10, b: 10 });
assert.equal(serializeCache(small as never, 10_000), JSON.stringify(small), 'under the cap: unchanged');

const big = persisted({ profile: 100, huge: 5_000, medium: 2_000, menu: 200 });
const fitted = serializeCache(big as never, 3_000);
assert.ok(fitted.length <= 3_000, `fits: ${fitted.length}`);
assert.deepEqual(keysOf(fitted), ['profile', 'medium', 'menu'], 'only the largest goes');
assert.deepEqual(keysOf(serializeCache(big as never, 1_000)), ['profile', 'menu'], 'then the next largest');
assert.equal(JSON.parse(serializeCache(big as never, 1_000)).timestamp, 1, 'keeps the envelope');

// --- an unreadable row is cleared and read as empty ---
async function checkGuard() {
  const removed: string[] = [];
  const warn = console.warn;
  console.warn = () => undefined;
  const broken = guardStorage({
    getItem: async () => {
      throw new Error('Row too big to fit into CursorWindow');
    },
    setItem: async () => undefined,
    removeItem: async (key) => {
      removed.push(key);
    },
  });
  assert.equal(await broken.getItem('cache'), null);
  assert.deepEqual(removed, ['cache']);

  const failsTwice = guardStorage({
    getItem: () => Promise.reject(new Error('read')),
    setItem: async () => undefined,
    removeItem: () => Promise.reject(new Error('remove')),
  });
  assert.equal(await failsTwice.getItem('cache'), null, 'a failed delete still starts cold');
  console.warn = warn;

  const fine = guardStorage({ getItem: async () => 'v', setItem: async () => undefined, removeItem: async () => undefined });
  assert.equal(await fine.getItem('cache'), 'v');
}

checkGuard().then(() => console.log('queryCachePersist checks passed'));
