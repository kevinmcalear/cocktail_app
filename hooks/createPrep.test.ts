import type { QueryClient } from '@tanstack/react-query';

import { createPrep } from '@/hooks/usePrepCard';
import { startPrep } from '@/lib/prepKinds';

// Bring in's save (createPrep): every new items row, and what a failed save deletes again.
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

test('a save that fails takes away the ingredients it added for names typed on a line, with the prep (review of #1183)', async () => {
  const prep = startPrep('syrup', 'Ginger syrup');
  prep.lines.push({ key: 'g', id: null, name: 'Fresh ginger juice', parts: 0.2, unit: 'g', amount: '' });
  const qc = { invalidateQueries: jest.fn() } as unknown as QueryClient;
  await expect(createPrep(qc, { name: 'Ginger syrup', prep, barId: 'bar-1' })).rejects.toEqual({ message: 'recipes refused' });
  expect(mockAdded.map((r) => r.name)).toEqual(['Ginger syrup', 'Sugar', 'Water', 'Fresh ginger juice']);
  // Everything this save added goes again: the prep and the three ingredients it made for its lines.
  expect(mockDeleted).toEqual([mockAdded.map((r) => r.id)]);
});
