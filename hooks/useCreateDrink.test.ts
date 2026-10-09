import { renderHook } from '@testing-library/react-native';

import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { EMPTY_DRAFT, sketchLook, type WizardDraft } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';
import { draftSketchInputs } from '@/lib/sketch/draft';
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
const mockSavePrepRecipe = jest.fn();
jest.mock('@/hooks/usePrepCard', () => ({
  savePrepCard: (...args: unknown[]) => mockSavePrepCard(...args),
  savePrepRecipe: (...args: unknown[]) => mockSavePrepRecipe(...args),
}));
jest.mock('@/hooks/useVersions', () => ({ saveDrinkSpec: (...args: unknown[]) => mockSaveSpec(...args) }));

// Rows that exist; 'gone' was merged away (deleted) after the draft picked it.
const LIVE = ['lime', 'shake'];
// Every drink insert's row, and ids the database already has.
const mockInserts: Record<string, unknown>[] = [];
const mockRpcs: [string, Record<string, unknown>][] = [];
const mockTaken = new Set<string>();
// Shared ingredient names already taken (the name guard answers with the one to use), and every ingredient insert.
const TAKEN_ID = '11111111-2222-3333-4444-555555555555';
const mockTakenNames = new Set<string>();
const mockIngredientInserts: Record<string, unknown>[] = [];
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
          if (table === 'items' && row.item_type === 'ingredient') {
            mockIngredientInserts.push(row);
            if (mockTakenNames.has(row.name as string)) return chain(() => ({ data: null, error: { code: 'P0001', message: 'taken', hint: TAKEN_ID } }));
          }
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
  const sketch = { glass: 'coupe', variant: 'coupe_nick' } as unknown as SketchInputs;
  const { id } = await result.current.mutationFn({ draft: { ...EMPTY_DRAFT, id: 'draft-1', name: 'Sour', creator: 'nobody' }, barId: null, myProfileId: null, sketch });
  expect(id).toBe('draft-1');
  expect(mockInserts.map((r) => r.id)).toEqual(['draft-1']);
  expect(mockSetQueryData).toHaveBeenCalledWith(['item-sketch', 'draft-1'], sketch);
  expect(mockRpcs).toContainEqual(['save_maker_sketch', { p_item_id: 'draft-1', p_inputs: sketch }]);
});

// valid_sketch_inputs refuses "variant": null (supabase/tests/maker-drawings.test.mjs), and most drinks pick no glass drawing.
test('a drawing with no glass variant is saved without one', async () => {
  mockRpcs.length = 0;
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const draft: WizardDraft = { ...EMPTY_DRAFT, id: 'draft-3', name: 'Sour', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Lime juice', amount: '30', unit: 'ml' }] };
  const sketch = draftSketchInputs(sketchLook(draft, []));
  expect(sketch.variant).toBeNull();
  await result.current.mutationFn({ draft, barId: null, myProfileId: null, sketch });
  const [, args] = mockRpcs.find(([fn]) => fn === 'save_maker_sketch')!;
  expect(args.p_inputs).not.toHaveProperty('variant');
  expect(args.p_inputs).toEqual(Object.fromEntries(Object.entries(sketch).filter(([k]) => k !== 'variant')));
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

test('a house prep made in the wizard is saved with its own recipe, not a technique card', async () => {
  mockSavePrepCard.mockClear();
  mockSavePrepRecipe.mockClear();
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const prep = startPrep('shrub', 'Pineapple chili shrub');
  await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, name: 'Pineapple Heat', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Pineapple chili shrub', amount: '20', unit: 'ml', prep }] },
    barId: null,
    myProfileId: null,
  });
  expect(mockSavePrepRecipe).toHaveBeenCalledTimes(1);
  const [id, saved, ensure] = mockSavePrepRecipe.mock.calls[0];
  expect(id).toBe('new-row');
  expect(saved).toBe(prep);
  expect(typeof ensure).toBe('function');
  expect(mockSavePrepCard).not.toHaveBeenCalled();
});

test('a prep made in the wizard is never swapped for a same-named one: at home it becomes "My …", your version of it', async () => {
  mockSavePrepRecipe.mockClear();
  mockIngredientInserts.length = 0;
  mockTakenNames.add('Cupuacu');
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const prep = startPrep('other', 'Cupuacu');
  await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, name: 'Cupuacu Sour', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'cupuacu', amount: '20', unit: 'ml', prep }] },
    barId: null,
    myProfileId: null,
  });
  mockTakenNames.clear();
  // No lookup by name: "Cupuacu" resolves to an existing row, which would drop the recipe.
  expect(mockRpcs.some(([fn, args]) => fn === 'resolve_ingredient' && args.p_name === 'cupuacu')).toBe(false);
  expect(mockIngredientInserts.map((r) => [r.name, r.generic_id, r.ingredient_role])).toEqual([
    ['Cupuacu', undefined, 'prep'],
    ['My Cupuacu', TAKEN_ID, 'prep'],
  ]);
  expect(mockSavePrepRecipe).toHaveBeenCalledTimes(1);
  expect(mockSavePrepRecipe.mock.calls[0][0]).toBe('new-row');
});

test('at a venue, a taken name stays the same: the venue’s own version', async () => {
  mockIngredientInserts.length = 0;
  mockTakenNames.add('Cupuacu');
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, name: 'Cupuacu Sour', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Cupuacu', amount: '20', unit: 'ml', prep: startPrep('other', 'Cupuacu') }] },
    barId: 'bar-1',
    myProfileId: null,
  });
  mockTakenNames.clear();
  expect(mockIngredientInserts.map((r) => [r.name, r.generic_id, r.bar_id])).toEqual([
    ['Cupuacu', undefined, 'bar-1'],
    ['Cupuacu', TAKEN_ID, 'bar-1'],
  ]);
});
