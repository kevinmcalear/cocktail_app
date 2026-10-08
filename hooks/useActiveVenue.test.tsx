import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useActiveVenue } from '@/hooks/useActiveVenue';

type Auth = { loading: boolean; user: { id: string } | null };
let mockAuth: Auth = { loading: true, user: null };
const mockFetches: string[] = [];

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => mockAuth }));
// The bars request never answers: like auth-js, it is still refreshing the token.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          mockFetches.push(table);
          return new Promise(() => {});
        },
      }),
    }),
  },
}));

const cachedBars = [{ bar_id: 'b1', role_level: 40, bars: { id: 'b1', name: 'Little Rye', logo_url: null } }];

function withCache(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

test("at launch, the saved user's cached venues show before auth settles, and stay once it does", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['bars', 'u1'], cachedBars);

  mockAuth = { loading: true, user: null };
  const { result, rerender, unmount } = await renderHook(() => useActiveVenue(), { wrapper: withCache(client) });
  expect(result.current).toMatchObject({ isLoading: true, active: null });

  // The saved session's user, read while auth-js refreshes.
  mockAuth = { loading: true, user: { id: 'u1' } };
  await rerender({});
  expect(result.current).toMatchObject({ isLoading: false, active: { id: 'b1', name: 'Little Rye', roleLevel: 40 } });

  // The refresh confirmed them.
  mockAuth = { loading: false, user: { id: 'u1' } };
  await rerender({});
  expect(result.current).toMatchObject({ isLoading: false, active: { id: 'b1' } });

  // Refresh failed: no user, so no venues (and the cache is cleared, hooks/useUserCacheSync.ts).
  mockAuth = { loading: false, user: null };
  await rerender({});
  expect(result.current).toMatchObject({ isLoading: false, active: null, venues: [] });
  expect(mockFetches).toEqual([]);
  await unmount();
  client.clear();
});

test('with nothing cached, the saved user waits for their venues', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockAuth = { loading: true, user: { id: 'u1' } };
  const { result, unmount } = await renderHook(() => useActiveVenue(), { wrapper: withCache(client) });
  expect(result.current).toMatchObject({ isLoading: true, active: null });
  await unmount();
  client.clear();
});
