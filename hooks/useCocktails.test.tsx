import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useUpdateCocktail } from '@/hooks/useCocktails';

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useViewAs', () => ({ useViewAs: () => ({ viewAsRoleLevel: null }) }));
jest.mock('@/store/useAppStore', () => ({ useAppStore: jest.fn() }));

// The save hangs until the test settles it, so the optimistic state can be read first.
let settle: (result: { data: unknown; error: unknown }) => void = () => {};
jest.mock('@/lib/supabase', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['update', 'eq', 'select']) q[m] = () => q;
  q.single = () => new Promise((resolve) => { settle = resolve; });
  return { supabase: { from: () => q } };
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  // Keys shaped like useCocktail's and useCocktails' real ones.
  client.setQueryData(['cocktail', 'm1', 3], { id: 'm1', name: 'Martini' });
  client.setQueryData(['cocktails', ['bar'], undefined, 3, 'me'], [{ id: 'm1', name: 'Martini' }, { id: 'n1', name: 'Negroni' }]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

test('an edit shows at once on the role-keyed drink and list entries, and rolls back on error', async () => {
  const { client, wrapper } = setup();
  const { result } = await renderHook(() => useUpdateCocktail(), { wrapper });

  let done!: Promise<unknown>;
  await act(async () => {
    done = result.current.mutateAsync({ id: 'm1', updates: { name: 'Dry Martini' } }).catch(() => null);
  });
  expect(client.getQueryData(['cocktail', 'm1', 3])).toEqual({ id: 'm1', name: 'Dry Martini' });
  expect(client.getQueryData<{ name: string }[]>(['cocktails', ['bar'], undefined, 3, 'me'])?.map((c) => c.name)).toEqual(['Dry Martini', 'Negroni']);

  await act(async () => {
    settle({ data: null, error: new Error('denied') });
    await done;
  });
  expect(client.getQueryData(['cocktail', 'm1', 3])).toEqual({ id: 'm1', name: 'Martini' });
  expect(client.getQueryData<{ name: string }[]>(['cocktails', ['bar'], undefined, 3, 'me'])?.map((c) => c.name)).toEqual(['Martini', 'Negroni']);
});
