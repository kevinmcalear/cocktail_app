import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useIngredientCatalog } from '@/hooks/useIngredientCatalog';
import type { FileStore } from '@/lib/fileStore';
import { createFilePersister, FILE_KEYS, PERSISTED_KEYS } from '@/lib/queryCachePersist';
import { BASE, DROPDOWNS_QUERY_KEY, KEEP, queryDefaults } from '@/lib/queryDefaults';

// The venues' own bottles as the database has them now; every read of them is counted.
let mockOwn: { id: string; name: string; bar_id: string | null }[] = [];
let mockReads = 0;
/** While set, reads wait for it. */
let mockGate: Promise<void> | null = null;
jest.mock('@/lib/supabase', () => {
  const page = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      gt: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (done: (r: unknown) => unknown) => {
        mockReads++;
        return Promise.resolve(mockGate)
          .then(() => ({ data: mockOwn, error: null }))
          .then(done);
      },
    };
    return chain;
  };
  return { supabase: { from: () => page() } };
});
jest.mock('@/lib/catalogFile', () => ({ readSavedCatalog: async () => null, saveCatalog: async () => undefined }));
jest.mock('@/lib/catalogDownload', () => ({ downloadShared: async () => [], refreshShared: () => undefined }));

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

/** A launch of the app, as lib/react-query.ts sets the client up: the file persister and the tiers' defaults. */
function launch(files: FileStore) {
  const queryCache = new QueryCache();
  const persister = createFilePersister(files, queryCache, { maxAge: KEEP, buster: 'v1' });
  const client = new QueryClient({ queryCache, defaultOptions: { queries: { ...BASE, retry: false, networkMode: 'offlineFirst', persister: persister.persisterFn } } });
  for (const { queryKey, options } of queryDefaults(PERSISTED_KEYS, FILE_KEYS)) client.setQueryDefaults(queryKey, options);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, hook: renderHook(() => useIngredientCatalog(), { wrapper }) };
}

/** The saved copy of the venues' own bottles. */
const savedOwn = (files: ReturnType<typeof memoryFiles>) =>
  [...files.map.values()] as { queryKey: unknown[]; state: { data: unknown; dataUpdatedAt: number } }[];

const GIN = { id: 'gin', name: 'House Gin', bar_id: 'rye' };
const RUM = { id: 'rum', name: 'Reload Rum', bar_id: 'rye' };

beforeEach(() => {
  mockOwn = [GIN];
  mockGate = null;
});

test('a copy saved by an earlier launch is read again behind it', async () => {
  const files = memoryFiles();
  const first = await launch(files).hook;
  await waitFor(() => expect(first.result.current.own).toEqual([GIN]));
  await waitFor(() => expect(files.map.size).toBe(1));
  await first.unmount();
  // As an earlier launch saved it (an hour ago, well inside the day the catalog tier keeps lists fresh).
  savedOwn(files)[0].state.dataUpdatedAt = Date.now() - 60 * 60 * 1000;

  // Saved since, by a teammate or a write that waited for signal.
  mockOwn = [GIN, RUM];
  const reads = mockReads;
  const reloaded = await launch(files).hook;
  await waitFor(() => expect(reloaded.result.current.own).toEqual([GIN, RUM]));
  expect(mockReads).toBe(reads + 1);
});

test("a save's read finishes and is saved when its screen closes first", async () => {
  const files = memoryFiles();
  const launched = launch(files);
  const hook = await launched.hook;
  await waitFor(() => expect(hook.result.current.own).toEqual([GIN]));
  await waitFor(() => expect(files.map.size).toBe(1));

  // Add-bottle saves (refreshIngredients) and opens the bottle's page before the read comes back.
  mockOwn = [GIN, RUM];
  let open!: () => void;
  mockGate = new Promise((resolve) => (open = resolve));
  void launched.client.invalidateQueries({ queryKey: [...DROPDOWNS_QUERY_KEY, 'ingredients'] });
  await hook.unmount();
  open();
  await waitFor(() => expect(savedOwn(files)[0].state.data).toEqual([GIN, RUM]));
});
