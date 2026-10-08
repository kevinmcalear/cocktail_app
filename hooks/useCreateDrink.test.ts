import { renderHook } from '@testing-library/react-native';

import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

// useMutation hands back its options, so the test can run mutationFn itself.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (opts: unknown) => opts,
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [], saveDraft: jest.fn() }) }));
jest.mock('@/hooks/useDropdowns', () => ({ DROPDOWNS_QUERY_KEY: ['dropdowns'] }));
jest.mock('@/hooks/useTrackRecent', () => ({ recentEntry: () => ({}) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockSaveSpec = jest.fn();
jest.mock('@/hooks/useVersions', () => ({ saveDrinkSpec: (...args: unknown[]) => mockSaveSpec(...args) }));

// Rows that exist; 'gone' was merged away (deleted) after the draft picked it.
const LIVE = ['lime', 'shake'];
jest.mock('@/lib/supabase', () => {
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'limit', 'update', 'delete']) q[m] = () => q;
    q.in = (_: string, ids: string[]) => ({ data: ids.filter((id) => LIVE.includes(id)).map((id) => ({ id })), error: null });
    q.maybeSingle = async () => result();
    q.single = async () => result();
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return q;
  };
  return {
    supabase: {
      rpc: async (_: string, { p_name }: { p_name: string }) => ({ data: p_name === 'Cupuacu' ? 'cupuacu-kept' : null, error: null }),
      from: () => ({ ...chain(() => ({ data: null, error: null })), insert: () => chain(() => ({ data: { id: 'new-drink' }, error: null })) }),
    },
  };
});

type Fn = (input: CreateDrinkInput) => Promise<CreateDrinkResult>;

test('a picked ingredient merged away since is saved by its name, not its old id', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  const line = (id: string, name: string) => ({ key: id, id, name, amount: '20', unit: 'ml' });
  await run({
    draft: { ...EMPTY_DRAFT, name: 'Sour', creator: 'nobody', lines: [line('lime', 'Lime'), line('gone', 'Cupuacu')], methods: [{ id: 'shake', name: 'Shake' }] },
    barId: null,
    myProfileId: null,
  });
  const [, lines, methods] = mockSaveSpec.mock.calls[0];
  expect(lines.map((l: { ingredient_item_id: string }) => l.ingredient_item_id)).toEqual(['lime', 'cupuacu-kept']);
  expect(methods).toEqual(['shake']);
});
