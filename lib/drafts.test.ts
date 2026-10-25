import { resolveIngredientId } from '@/lib/drafts';

const mockDeletes: string[] = [];
let mockCategoryError: { message: string } | null = null;
jest.mock('@/lib/monitoring', () => ({ reportError: jest.fn() }));
// 'gin' exists; 'gone' was merged into another ingredient and deleted.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let id = '';
      let deleting = false;
      const q = {
        select: () => q,
        insert: () => q,
        upsert: async () => ({ error: table === 'item_categories' ? mockCategoryError : null }),
        delete: () => ((deleting = true), q),
        single: async () => ({ data: { id: 'new' }, error: null }),
        eq: (_: string, v: string) => {
          id = v;
          if (deleting) {
            mockDeletes.push(`${table}:${v}`);
            return Promise.resolve({ error: null });
          }
          return q;
        },
        maybeSingle: async () => ({ data: id === 'gin' ? { id } : null, error: null }),
      };
      return q;
    },
    rpc: async (_: string, { p_name }: { p_name: string }) => ({ data: p_name === 'Cupuacu' ? 'cupuacu-kept' : null, error: null }),
  },
}));

beforeEach(() => {
  mockDeletes.length = 0;
  mockCategoryError = null;
});

test('a published id that still exists is kept', async () => {
  expect(await resolveIngredientId('gin', [], 'Gin')).toBe('gin');
});

test('an id merged away since the draft was saved goes by its name', async () => {
  expect(await resolveIngredientId('gone', [], 'Cupuacu')).toBe('cupuacu-kept');
});

test('a gone id whose name matches nothing says to pick it again', async () => {
  await expect(resolveIngredientId('gone', [], 'Mystery')).rejects.toThrow('Mystery isn’t in the catalog any more');
});

const draft = { id: 'd1', entity_type: 'ingredient', draft_data: { name: 'Orgeat', selectedCategories: ['syrups'] } };

test('a published draft ingredient deletes its draft', async () => {
  expect(await resolveIngredientId('d1', [draft])).toBe('new');
  expect(mockDeletes).toEqual(['drafts:d1']);
});

test('a category that fails removes the new ingredient and keeps the draft', async () => {
  mockCategoryError = { message: 'denied' };
  await expect(resolveIngredientId('d1', [draft])).rejects.toEqual({ message: 'denied' });
  expect(mockDeletes).toEqual(['items:new']);
});
