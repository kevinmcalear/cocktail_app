import { act, render } from '@testing-library/react-native';
import type { PersistedClient } from '@tanstack/query-persist-client-core';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { useUserCacheSync } from '@/hooks/useUserCacheSync';
import { clearUserData } from '@/lib/clearUserData';
import { persistOptions, queryClient } from '@/lib/react-query';

// The saved cache's storage: getItem waits on `mockStore.release` when
// `held`, so a test can finish auth before the saved cache has loaded.
const mockStore = {
  value: null as string | null,
  /** Every write in order; null is a removal. */
  writes: [] as (string | null)[],
  held: false,
  release: () => {},
};
type Auth = { loading: boolean; user: { id: string } | null; session: { user: { id: string } } | null };
let mockAuth: Auth = { loading: true, user: null, session: null };

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/deviceStore', () => ({ deviceStore: { removeItem: async () => {} } }));
// The real persister, over mockStore, throttled to 50 ms instead of 5 s.
jest.mock('@/lib/react-query', () => {
  const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  const { createCachePersister, shouldPersistQuery } = jest.requireActual<typeof import('@/lib/queryCachePersist')>('@/lib/queryCachePersist');
  const asyncStoragePersister = createCachePersister(
    {
      // Like real storage, a read returns what was there when it was asked.
      getItem: () => {
        const value = mockStore.value;
        return mockStore.held ? new Promise((done) => (mockStore.release = () => done(value))) : Promise.resolve(value);
      },
      setItem: async (_key: string, value: string) => {
        mockStore.value = value;
        mockStore.writes.push(value);
      },
      removeItem: async () => {
        mockStore.value = null;
        mockStore.writes.push(null);
      },
    },
    50,
  );
  const queryClient = new QueryClient();
  return {
    queryClient,
    asyncStoragePersister,
    persistOptions: { persister: asyncStoragePersister, dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } },
  };
});

const settled = (id: string | null): Auth => ({ loading: false, user: id ? { id } : null, session: id ? { user: { id } } : null });
const wait = (ms: number) => act(() => new Promise<void>((done) => setTimeout(done, ms)));

/** Query keys in the saved cache, or null when there is none. */
const savedKeys = () =>
  mockStore.value === null
    ? null
    : (JSON.parse(mockStore.value) as PersistedClient).clientState.queries.map((q) => JSON.stringify(q.queryKey));

function savedWith(data: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: Date.now(),
    buster: '',
    clientState: {
      mutations: [],
      queries: Object.entries(data).map(([hash, value]) => ({
        queryKey: JSON.parse(hash),
        queryHash: hash,
        state: { data: value, dataUpdatedAt: Date.now(), status: 'success', fetchStatus: 'idle', error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, dataUpdateCount: 1 },
      })),
    },
  });
}

function App() {
  useUserCacheSync();
  return null;
}

const app = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <App />
  </PersistQueryClientProvider>
);

// Drops the queries' garbage-collection timers, which would keep Jest running.
afterAll(() => queryClient.clear());

beforeEach(() => {
  queryClient.clear();
  mockStore.value = null;
  mockStore.held = false;
});

test('opened signed out, auth settling before the saved cache loads: the previous user is still forgotten', async () => {
  mockStore.value = savedWith({ '["bars","u1"]': [{ id: 'bar-1' }] });
  mockStore.held = true;
  mockAuth = { loading: true, user: null, session: null };
  const { rerender, unmount } = await render(app());

  mockAuth = settled(null);
  await rerender(app());
  await act(async () => mockStore.release());
  await wait(200);

  expect(queryClient.getQueryData(['bars', 'u1'])).toBeUndefined();
  expect(savedKeys() ?? []).not.toContain('["bars","u1"]');
  await unmount();
});

test('signing out while a save is under way: the save does not write the old cache back', async () => {
  mockAuth = settled('u1');
  const { unmount } = await render(app());
  await wait(10);
  queryClient.setQueryData(['bars', 'u1'], [{ id: 'bar-1' }]);
  await wait(100);
  expect(savedKeys()).toEqual(['["bars","u1"]']);

  // This save serializes now and writes a tick later, after the removal.
  mockStore.writes = [];
  queryClient.setQueryData(['bars', 'u1'], [{ id: 'bar-1' }, { id: 'bar-2' }]);
  await clearUserData();
  await wait(200);
  const removal = mockStore.writes.lastIndexOf(null);
  expect(removal).toBeGreaterThanOrEqual(0);
  expect(mockStore.writes.slice(removal + 1).filter((w) => w?.includes('"u1"'))).toEqual([]);
  expect(savedKeys() ?? []).not.toContain('["bars","u1"]');

  // Saves taken after the removal are written as usual.
  queryClient.setQueryData(['bars', 'u2'], [{ id: 'bar-3' }]);
  await wait(200);
  expect(savedKeys()).toEqual(['["bars","u2"]']);
  await unmount();
});
