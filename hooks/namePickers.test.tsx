import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useCatalogBottles } from '@/hooks/useCreateBeerWine';
import { useGlassModelSearch } from '@/hooks/useGlassModels';
import { useMakerSearch } from '@/hooks/useMakers';
import { usePublicPeople } from '@/hooks/useProfilePositions';
import { usePublicBars } from '@/hooks/useRankings';
import { usePartySearch } from '@/hooks/useRunSheet';
import { useClaimableBars } from '@/hooks/useVenueSetup';

// Every request a picker sends: a table read or an RPC. Plain reads find one
// row, search_near offers another, so a close name's read by id runs too.
let mockRequests: string[] = [];
jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me', useSignedIn: () => true }));
jest.mock('@/lib/supabase', () => {
  const chain = (name: string, rows: unknown[]): unknown => {
    mockRequests.push(name);
    const c: Record<string, unknown> = new Proxy(
      {},
      { get: (_, key) => (key === 'then' ? (done: (r: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(done) : () => c) }
    );
    return c;
  };
  return {
    supabase: {
      from: (table: string) => chain(table, [{ id: 'plain', display_name: 'Plain', item_categories: [] }]),
      rpc: (name: string) => chain(name, [{ id: 'close' }]),
    },
  };
});

const PICKERS: [string, (q: string) => unknown][] = [
  ['usePublicPeople', (q) => usePublicPeople(q, { near: true })],
  ['usePublicBars', (q) => usePublicBars(q, { near: true })],
  ['useClaimableBars', (q) => useClaimableBars(q)],
  ['useMakerSearch', (q) => useMakerSearch(q, 'ice')],
  ['usePartySearch', (q) => usePartySearch(q, 'guest')],
  ['useGlassModelSearch', (q) => useGlassModelSearch(q, null)],
  ['useCatalogBottles', (q) => useCatalogBottles('beer', q)],
];

/** Types `word` at five letters a second, then waits; returns the requests sent. */
async function typeWord(use: (q: string) => unknown, word: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { rerender, result } = await renderHook(({ q }: { q: string }) => use(q) as { data?: unknown[]; isFetching: boolean }, { wrapper, initialProps: { q: '' } });
  for (let i = 1; i <= word.length; i++) {
    await rerender({ q: word.slice(0, i) });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
  }
  // The pause, then the reads settle (TanStack batches its updates on a timer too).
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
  }
  return { requests: mockRequests, result, rerender };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockRequests = [];
});
afterEach(() => jest.useRealTimers());

describe.each(PICKERS)('%s waits for a pause in typing', (_, use) => {
  test('a word typed at five letters a second sends one search', async () => {
    const { requests } = await typeWord(use, 'lantern');
    // The plain read, and for pickers with close names, search_near and the read by id.
    expect(requests.length).toBeLessThanOrEqual(3);
    expect(requests.length).toBeGreaterThan(0);
  });

  test('it reads as fetching while it waits for the pause, so "no match" waits too', async () => {
    const { result, rerender } = await typeWord(use, 'lantern');
    await rerender({ q: 'lanterns' });
    expect(result.current.isFetching).toBe(true);
  });

  test('clearing the field empties the list at once', async () => {
    const { result, rerender } = await typeWord(use, 'lantern');
    expect(result.current.data?.length).toBeGreaterThan(0);
    await rerender({ q: '' });
    expect(result.current.data ?? []).toEqual([]);
  });
});
