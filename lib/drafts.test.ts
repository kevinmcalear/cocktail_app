import { resolveIngredientId } from '@/lib/drafts';

// 'gin' exists; 'gone' was merged into another ingredient and deleted.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      let id = '';
      const q = {
        select: () => q,
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
