import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useIngredientCatalog } from '@/hooks/useIngredientCatalog';
import type { FileStore } from '@/lib/fileStore';
import { createFilePersister, FILE_KEYS, PERSISTED_KEYS } from '@/lib/queryCachePersist';
import { BASE, KEEP, queryDefaults } from '@/lib/queryDefaults';

// The venues' own bottles as the database has them now; every read of them is counted.
let mockOwn: { id: string; name: string; bar_id: string | null }[] = [];
let mockReads = 0;
jest.mock('@/lib/supabase', () => {
  const page = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      gt: () => chain,
      order: () => chain,
      limit: () => chain,
      abortSignal: () => chain,
      then: (done: (r: unknown) => unknown) => {
        mockReads++;
        return Promise.resolve({ data: mockOwn, error: null }).then(done);
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
  return renderHook(() => useIngredientCatalog(), { wrapper });
}

const GIN = { id: 'gin', name: 'House Gin', bar_id: 'rye' };
const RUM = { id: 'rum', name: 'Reload Rum', bar_id: 'rye' };

test('after a reload, the saved venue bottles are read again behind the saved copy', async () => {
  const files = memoryFiles();
  mockOwn = [GIN];
  const first = await launch(files);
  await waitFor(() => expect(first.result.current.own).toEqual([GIN]));
  await waitFor(() => expect(files.map.size).toBe(1));
  await first.unmount();

  // Saved since that copy, and the refresh that would have saved it again never ran
  // (the saving screen closed and cancelled it, a teammate added it, or the write waited for signal).
  mockOwn = [GIN, RUM];
  const reads = mockReads;
  const reloaded = await launch(files);
  await waitFor(() => expect(reloaded.result.current.own).toEqual([GIN, RUM]));
  expect(mockReads).toBe(reads + 1);
});
