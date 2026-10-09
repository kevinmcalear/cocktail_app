import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';

import { PERSISTED_KEYS } from './queryCachePersist';
import { BASE, GC_TIME, KEEP, queryDefaults } from './queryDefaults';

const MIN = 60_000;
const client = new QueryClient({ defaultOptions: { queries: { ...BASE } } });
for (const { queryKey, options } of queryDefaults(PERSISTED_KEYS)) client.setQueryDefaults(queryKey, options);
const opts = (queryKey: unknown[]) => {
  const o = client.defaultQueryOptions({ queryKey });
  return { staleTime: o.staleTime, gcTime: o.gcTime, focus: o.refetchOnWindowFocus };
};

// Anything not in a tier: 5 minutes fresh, 30 in memory, no refetch on return.
assert.deepEqual(opts(['some-new-thing', 1]), { staleTime: 5 * MIN, gcTime: GC_TIME, focus: false });
// Static reference: a day, and the saved spec lists stay a week.
assert.deepEqual(opts(['dropdowns_v7', 'specs']), { staleTime: 24 * 60 * MIN, gcTime: KEEP, focus: false });
assert.deepEqual(opts(['drink-tree']), { staleTime: 24 * 60 * MIN, gcTime: GC_TIME, focus: false });
// The ingredient catalog: a day, not kept a week (never saved).
assert.deepEqual(opts(['dropdowns_v7', 'ingredients']), { staleTime: 24 * 60 * MIN, gcTime: GC_TIME, focus: false });
// Drink pages: public, saved.
assert.deepEqual(opts(['cocktail', 'id', null]), { staleTime: 10 * MIN, gcTime: KEEP, focus: false });
// Yours: refetched on return; your profile beats anyone's.
assert.deepEqual(opts(['bars', 'u1']), { staleTime: 60 * MIN, gcTime: KEEP, focus: true });
assert.deepEqual(opts(['profile', 'mine', 'u1']), { staleTime: 60 * MIN, gcTime: KEEP, focus: true });
assert.deepEqual(opts(['profile', { id: 'p' }, 'u1']), { staleTime: 10 * MIN, gcTime: GC_TIME, focus: false });
assert.deepEqual(opts(['menus-v2', 'venue-2', 'b1']), { staleTime: 15 * MIN, gcTime: KEEP, focus: true });
assert.deepEqual(opts(['menus-v2', 'detail', 'm1']), { staleTime: 15 * MIN, gcTime: GC_TIME, focus: true });
assert.deepEqual(opts(['dropdowns_v7', 'current_menu_drinks', 'with-glass', ['m']]), { staleTime: 15 * MIN, gcTime: KEEP, focus: true });
// Live: half a minute, refetched on return.
assert.deepEqual(opts(['drafts', 'u1']), { staleTime: 30_000, gcTime: GC_TIME, focus: true });
assert.deepEqual(opts(['profile-claims', 'pending']), { staleTime: 30_000, gcTime: GC_TIME, focus: true });
// Discover keeps its own options; only what it saves stays a week.
assert.deepEqual(opts(['discover-list', 'x']), { staleTime: 5 * MIN, gcTime: KEEP, focus: false });
assert.deepEqual(opts(['discover-rankings', 'x']), { staleTime: 5 * MIN, gcTime: GC_TIME, focus: false });
assert.deepEqual(opts(['bar-cities']), { staleTime: 60 * MIN, gcTime: KEEP, focus: false });

// Every saved prefix is kept as long as the saved cache.
for (const key of PERSISTED_KEYS) assert.equal(opts([...key, 'x']).gcTime, KEEP, key.join('/'));

console.log('queryDefaults: ok');
