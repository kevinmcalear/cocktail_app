import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { cacheActionOnAuth, isUserQuery, resetUserQueries, viewerScoped } from './authCache';

// --- what happens when auth settles ---
assert.equal(cacheActionOnAuth(undefined, null), 'clear', 'opened signed out');
assert.equal(cacheActionOnAuth(undefined, 'a'), null, 'relaunch signed in keeps the persisted cache');
assert.equal(cacheActionOnAuth('a', 'a'), null, 'token refresh');
assert.equal(cacheActionOnAuth('a', null), 'clear', 'signed out');
assert.equal(cacheActionOnAuth(null, null), null, 'still signed out');
assert.equal(cacheActionOnAuth(null, 'a'), 'reset', 'signed in');
assert.equal(cacheActionOnAuth('a', 'b'), 'reset', 'switched user');

// --- a reset wins over anon fetches ---
// Stands in for RLS: anon sees no rows, the signed-in user sees theirs.
let token: string | null = null;
const rows = async () => {
  const seen = token;
  await new Promise((r) => setTimeout(r, 20));
  return seen ? ['coupe', 'rocks'] : [];
};

async function main() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 60 * 1000, retry: false } } });
  const onScreen = new QueryObserver(client, { queryKey: ['dropdowns'], queryFn: rows });
  const unsubscribe = onScreen.subscribe(() => {});
  client.setQueryData(['cached'], []); // fetched anon earlier, not on screen now
  client.setQueryDefaults(['branding'], { meta: { public: true } });
  client.setQueryData(['branding'], 'venue');

  // Sign-in lands while the on-screen query's anon fetch is still in flight.
  await new Promise((r) => setTimeout(r, 5));
  token = 'a';
  await resetUserQueries(client);
  await new Promise((r) => setTimeout(r, 40)); // let the cancelled anon fetch finish

  assert.deepEqual(client.getQueryData(['dropdowns']), ['coupe', 'rocks'], 'anon result never lands');
  assert.equal(client.getQueryData(['cached']), undefined, 'off-screen anon data is dropped, refetched on mount');
  assert.equal(client.getQueryData(['branding']), 'venue', 'public queries survive');

  unsubscribe();
  client.clear();
  console.log('authCache.check.ts: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// --- reads a signed-out page shows: public only while signed out ---
assert.deepEqual(viewerScoped(null), { key: 'signed-out', meta: { public: true } });
assert.deepEqual(viewerScoped(undefined), { key: 'signed-out', meta: { public: true } });
assert.deepEqual(viewerScoped('a'), { key: 'a', meta: { public: false } });
{
  const client = new QueryClient();
  for (const viewer of [viewerScoped(null), viewerScoped('a')]) {
    client.getQueryCache().build(client, { queryKey: ['profile', 'x', viewer.key], meta: viewer.meta });
  }
  client.removeQueries({ predicate: isUserQuery });
  assert.deepEqual(
    client.getQueryCache().getAll().map((q) => q.queryKey),
    [['profile', 'x', 'signed-out']],
    'signing out forgets the signed-in read and keeps the signed-out one'
  );
}
