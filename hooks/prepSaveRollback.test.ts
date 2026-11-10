import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useCreateIngredient } from '@/hooks/useCreateIngredient';
import { createPrep } from '@/hooks/usePrepCard';
import { EMPTY_INGREDIENT } from '@/lib/ingredientWizard';
import { startPrep } from '@/lib/prepKinds';

// Saves that add a house-made and its recipe (Bring in's createPrep, the ingredient wizard's): every new items row, and what a failed save deletes again.
const mockAdded: { id: string; name: string }[] = [];
const mockDeleted: string[][] = [];
jest.mock('@/hooks/useDropdowns', () => ({ refreshIngredients: async () => {} }));
jest.mock('@/lib/supabase', () => {
  // A query that answers `result` however it's chained.
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'limit', 'order']) q[m] = () => q;
    q.single = q.maybeSingle = async () => result();
    q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return q;
  };
  return {
    supabase: {
      rpc: async () => ({ data: null, error: null }),
      from: (table: string) => ({
        ...chain(() => ({ data: null, error: null })),
        insert: (row: { name?: string }) =>
          table === 'items'
            ? chain(() => {
                const id = `new-${mockAdded.length + 1}`;
                mockAdded.push({ id, name: row.name ?? '' });
                return { data: { id }, error: null };
              })
            : // The recipe lines don't go in: the save fails after its new ingredients were added.
              chain(() => ({ data: null, error: { message: 'recipes refused' } })),
        update: () => chain(() => ({ data: null, error: null })),
        delete: () => ({ in: async (_: string, ids: string[]) => (mockDeleted.push(ids), { error: null }) }),
      }),
    },
  };
});

beforeEach(() => {
  mockAdded.length = 0;
  mockDeleted.length = 0;
});

test('a save that fails takes away the ingredients it added for names typed on a line, with the prep (review of #1183)', async () => {
  const prep = startPrep('syrup', 'Ginger syrup');
  prep.lines.push({ key: 'g', id: null, name: 'Fresh ginger juice', parts: 0.2, unit: 'g', amount: '' });
  const qc = { invalidateQueries: jest.fn() } as unknown as QueryClient;
  await expect(createPrep(qc, { name: 'Ginger syrup', prep, barId: 'bar-1' })).rejects.toEqual({ message: 'recipes refused' });
  expect(mockAdded.map((r) => r.name)).toEqual(['Ginger syrup', 'Sugar', 'Water', 'Fresh ginger juice']);
  // Everything this save added goes again: the prep and the three ingredients it made for its lines.
  expect(mockDeleted).toEqual([mockAdded.map((r) => r.id)]);
});

test('the ingredient wizard’s save that fails takes away the ingredients it added too', async () => {
  // No garbage-collection timers left behind, so Jest exits.
  const client = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity }, queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const { result } = await renderHook(() => useCreateIngredient(), { wrapper });
  const lines = [{ key: 'a', id: null, name: 'Fresh ginger juice', amount: '100', unit: 'ml' }];
  await expect(result.current.mutateAsync({ draft: { ...EMPTY_INGREDIENT, name: 'Ginger syrup', role: 'prep', lines }, barId: 'bar-1' })).rejects.toEqual({ message: 'recipes refused' });
  expect(mockAdded.map((r) => r.name)).toEqual(['Ginger syrup', 'Fresh ginger juice']);
  expect(mockDeleted).toEqual([mockAdded.map((r) => r.id)]);
});
