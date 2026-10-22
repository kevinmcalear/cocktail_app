import { resolveBeerId, resolveIngredientId, resolveWineId } from '@/lib/drafts';

const mockInserts: Record<string, unknown>[] = [];
// 'gin' exists; 'gone' was merged into another ingredient and deleted.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      let id = '';
      const q = {
        select: () => q,
        insert: (row: Record<string, unknown>) => (mockInserts.push(row), q),
        delete: () => q,
        single: async () => ({ data: { id: 'new' }, error: null }),
        eq: (_: string, v: string) => ((id = v), q),
        maybeSingle: async () => ({ data: id === 'gin' ? { id } : null, error: null }),
      };
      return q;
    },
    rpc: async (_: string, { p_name }: { p_name: string }) => ({ data: p_name === 'Cupuacu' ? 'cupuacu-kept' : null, error: null }),
  },
}));

test('a published id that still exists is kept', async () => {
  expect(await resolveIngredientId('gin', [], 'Gin')).toBe('gin');
});

test('an id merged away since the draft was saved goes by its name', async () => {
  expect(await resolveIngredientId('gone', [], 'Cupuacu')).toBe('cupuacu-kept');
});

test('a gone id whose name matches nothing says to pick it again', async () => {
  await expect(resolveIngredientId('gone', [], 'Mystery')).rejects.toThrow('Mystery isn’t in the catalog any more');
});

test.each([
  ['19.50', '19.50'],
  ['MP', 'MP'],
  ['', null],
])('a drafted beer or wine priced %j publishes with price %j (items.price is text)', async (typed, saved) => {
  mockInserts.length = 0;
  await resolveBeerId('d1', [{ id: 'd1', entity_type: 'beer', draft_data: { name: 'Lager', price: typed } }]);
  await resolveWineId('d2', [{ id: 'd2', entity_type: 'wine', draft_data: { name: 'Rosé', price: typed } }]);
  expect(mockInserts.map((r) => r.price)).toEqual([saved, saved]);
});
