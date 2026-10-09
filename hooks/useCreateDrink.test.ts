import { renderHook } from '@testing-library/react-native';

import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import type { SketchInputs } from '@/lib/sketch/types';

const mockSetQueryData = jest.fn();
// useMutation hands back its options, so the test can run mutationFn itself.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (opts: unknown) => opts,
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: (...args: unknown[]) => mockSetQueryData(...args) }),
}));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'me' } })));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [], saveDraft: jest.fn() }) }));
jest.mock('@/hooks/useDropdowns', () => ({ dropdownKeys: { specs: ['dropdowns', 'specs'] }, refreshIngredients: jest.fn() }));
jest.mock('@/hooks/useTrackRecent', () => ({ recentEntry: () => ({}) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockSaveSpec = jest.fn();
const mockSavePrepCard = jest.fn();
jest.mock('@/hooks/usePrepCard', () => ({ savePrepCard: (...args: unknown[]) => mockSavePrepCard(...args) }));
jest.mock('@/hooks/useVersions', () => ({ saveDrinkSpec: (...args: unknown[]) => mockSaveSpec(...args) }));

// Rows that exist; 'gone' was merged away (deleted) after the draft picked it.
const LIVE = ['lime', 'shake'];
// Every drink insert's row, and ids the database already has.
const mockInserts: Record<string, unknown>[] = [];
const mockRpcs: [string, Record<string, unknown>][] = [];
const mockTaken = new Set<string>();
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
      rpc: async (fn: string, args: Record<string, unknown>) => {
        mockRpcs.push([fn, args]);
        return { data: args.p_name === 'Cupuacu' ? 'cupuacu-kept' : null, error: null };
      },
      from: (table: string) => ({
        ...chain(() => ({ data: null, error: null })),
        insert: (row: Record<string, unknown>) => {
          if (table !== 'items' || row.item_type !== 'cocktail') return chain(() => ({ data: { id: 'new-row' }, error: null }));
          mockInserts.push(row);
          const id = row.id as string | undefined;
          if (id && mockTaken.has(id)) return chain(() => ({ data: null, error: { code: '23505', message: 'duplicate key' } }));
          return chain(() => ({ data: { id: id ?? 'db-made' }, error: null }));
        },
      }),
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

test('the drink is saved under its draft id and shows the wizard\'s drawing at once', async () => {
  mockInserts.length = 0;
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const sketch = { glass: 'coupe' } as unknown as SketchInputs;
  const { id } = await result.current.mutationFn({ draft: { ...EMPTY_DRAFT, id: 'draft-1', name: 'Sour', creator: 'nobody' }, barId: null, myProfileId: null, sketch });
  expect(id).toBe('draft-1');
  expect(mockInserts.map((r) => r.id)).toEqual(['draft-1']);
  expect(mockSetQueryData).toHaveBeenCalledWith(['item-sketch', 'draft-1'], sketch);
  expect(mockRpcs).toContainEqual(['save_maker_sketch', { p_item_id: 'draft-1', p_inputs: sketch }]);
});

test('an id the database already has saves under one of its own', async () => {
  mockInserts.length = 0;
  mockTaken.add('draft-2');
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const { id } = await result.current.mutationFn({ draft: { ...EMPTY_DRAFT, id: 'draft-2', name: 'Sour', creator: 'nobody' }, barId: null, myProfileId: null });
  expect(id).toBe('db-made');
  expect(mockInserts.map((r) => r.id)).toEqual(['draft-2', undefined]);
});

test('a new house prep made by a technique gets its prep card; one already on the shelf keeps its own', async () => {
  mockSavePrepCard.mockClear();
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const made = (key: string, name: string) => ({ key, id: null, name, amount: '40', unit: 'ml', technique: 'agar-quick' });
  await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, name: 'Clear Paloma', creator: 'nobody', lines: [made('a', 'Clarified grapefruit'), made('b', 'Cupuacu')] },
    barId: null,
    myProfileId: null,
  });
  expect(mockSavePrepCard).toHaveBeenCalledTimes(1);
  const [itemId, card] = mockSavePrepCard.mock.calls[0];
  expect(itemId).toBe('new-row');
  expect(card.prep.actions).toEqual(['Clarify']);
  expect(card.steps[0].body).toBe('For 375 g juice: 125 g water, 1 g agar.');
});
