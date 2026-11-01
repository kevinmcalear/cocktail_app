// Checks for lib/queryCachePersist.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { dehydrate, QueryCache, QueryClient } from '@tanstack/react-query';

import type { FileStore } from './fileStore';
import { createFilePersister, fileNameFor, guardStorage, pruneQueryFiles, savedIn, serializeCache, shouldPersistQuery } from './queryCachePersist';

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
build(['menus-v2', 'venue-5', 'b1', 'u1']).setData([]);
build(['menus-v2', 'detail', 'm1']).setData({});
build(['item-sketch', 'c1']).setData({});
build(['bars', 'denied'], false).setData([1]);
build(['still-loading']);

const saved = dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((q) => q.queryHash);
assert.deepEqual(saved.sort(), [
  '["bars","u1"]',
  '["menus-v2","venue-5","b1","u1"]',
  '["profile","mine","u1"]',
], 'only the first screen goes in the row; persist false always wins');
const home = (queryKey: unknown[], persist?: boolean) => savedIn({ queryKey, meta: persist === undefined ? undefined : { persist } });
assert.equal(home(['cocktail', 'c1', null]), 'file', 'a drink page opened is a file');
assert.equal(home(['dropdowns_v7', 'specs'], true), 'file', 'meta.persist true is a file');
assert.equal(home(['bars', 'u1'], true), 'row', 'the first screen stays in the row, marked or not');
assert.equal(home(['cocktail', 'c1', null], false), null, 'persist false always wins');
assert.equal(home(['spec-book', 'b1', null], false), null, 'a spec book is its own file (lib/specBookFile.ts)');
assert.equal(home(['item-sketch', 'c1']), null);

// --- file names ---
assert.equal(fileNameFor('["cocktail","c1",null]'), fileNameFor('["cocktail","c1",null]'), 'stable');
assert.notEqual(fileNameFor('["cocktail","c1",null]'), fileNameFor('["cocktail","c2",null]'));
assert.match(fileNameFor('["dropdowns_v7","current_menu_drinks",["m1"]]'), /^[0-9a-z]{1,11}$/, 'short and file-safe');

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

// --- a query saved in its own file ---
function memoryFiles(): FileStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    read: async (name) => structuredClone(map.get(name) ?? null),
    write: async (name, value) => void map.set(name, structuredClone(value)),
    remove: async (name) => void map.delete(name),
    names: async () => [...map.keys()],
    clear: async () => map.clear(),
  };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function checkFiles() {
  const files = memoryFiles();
  const saving = { maxAge: 60_000, buster: 'v1' };
  const launch = () => {
    const cache = new QueryCache();
    return { client: new QueryClient({ queryCache: cache, defaultOptions: { queries: { retry: false } } }), files: createFilePersister(files, cache, saving) };
  };
  let fetches = 0;
  const drink = (id: string, persister: ReturnType<typeof launch>['files']) => ({
    queryKey: ['cocktail', id, null],
    queryFn: async () => ({ id, fetch: ++fetches }),
    persister: persister.persisterFn,
    staleTime: 60_000,
  });

  const first = launch();
  await first.client.fetchQuery(drink('c1', first.files));
  await tick();
  assert.equal(files.map.size, 1, 'saved after it fetched');

  const next = launch();
  assert.deepEqual(await next.client.fetchQuery(drink('c1', next.files)), { id: 'c1', fetch: 1 }, 'read back after a relaunch');
  assert.equal(fetches, 1, 'and not fetched again while fresh');

  await first.client.fetchQuery({ queryKey: ['bars', 'u1'], queryFn: async () => [1], persister: first.files.persisterFn });
  await tick();
  assert.equal(files.map.size, 1, 'a row query is not a file');

  await first.client.fetchQuery(drink('c2', first.files));
  first.client.removeQueries();
  await tick();
  assert.equal(files.map.size, 1, 'removed (sign-out) before its save landed: not written');

  const other = createFilePersister(files, new QueryCache(), { ...saving, buster: 'v2' });
  const afterUpdate = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  assert.deepEqual(await afterUpdate.fetchQuery(drink('c1', other)), { id: 'c1', fetch: 3 }, 'another app version fetches');

  files.map.clear();
  const old = launch();
  await old.client.fetchQuery(drink('c4', old.files));
  await tick();
  assert.equal(files.map.size, 1);
  await pruneQueryFiles(files, saving, Date.now() + 120_000);
  assert.equal(files.map.size, 0, 'a file past maxAge is pruned');
}

checkGuard()
  .then(checkFiles)
  .then(() => console.log('queryCachePersist checks passed'));
