import { renderHook } from '@testing-library/react-native';

import type { CreateDrinkInput, CreateDrinkResult } from '@/hooks/useCreateDrink';
import { newDrinkSaved, useCreateDrink } from '@/hooks/useCreateDrink';
import { specFingerprint } from '@/lib/offlineWrites';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { linesOnKeptHouseMades } from '@/hooks/specLineSave';
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
// Rows for other tables, by table.
const mockOtherInserts: [string, Record<string, unknown>][] = [];
// Every delete, by table; and save_house_mades or save_drink refusing (a name taken) or losing the connection when set.
const mockDeletes: [string, string[]][] = [];
const mockHouseMade: { refuse: string | null; deleteFails?: boolean; drops?: boolean } = { refuse: null };
type Ref = { house_made?: number; id?: string; name?: string; own?: boolean; allergens?: string[] };
type Saved = { drink?: Record<string, unknown>; bar: string | null; preps: { name: string }[]; lines: { ingredient: Ref; amount: number; unit: string }[]; methods: string[]; credits?: unknown };
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
        if (fn === 'save_house_mades' || fn === 'save_drink') {
          if (mockHouseMade.refuse) return { data: null, error: { code: 'P0001', message: mockHouseMade.refuse } };
          if (mockHouseMade.drops) throw new TypeError('Network request failed');
        }
        if (fn === 'save_house_mades') return { data: (args.p_preps as unknown[]).map((_, i) => `made-${i}`), error: null };
        // save_drink, as the database answers it: the drink (its draft id unless that's taken), each house-made, and each line's row.
        if (fn === 'save_drink') {
          const save = args.p_save as Saved;
          const id = save.drink?.id as string | undefined;
          if (save.drink) mockInserts.push(save.drink);
          const row = (r: Ref) =>
            r.house_made !== undefined ? { id: `made-${r.house_made}`, new: false } : r.id && LIVE.includes(r.id) ? { id: r.id, new: false } : r.name === 'Cupuacu' ? { id: 'cupuacu-kept', new: false } : { id: 'new-row', new: true };
          const item = id && !mockTaken.has(id) ? id : 'db-made';
          return { data: { item, version: 1, house_mades: save.preps.map((_, i) => `made-${i}`), lines: save.lines.map((l) => row(l.ingredient)) }, error: null };
        }
        return { data: args.p_name === 'Cupuacu' ? 'cupuacu-kept' : null, error: null };
      },
      from: (table: string) => ({
        // The lead creator's credit, once set_drink_credits has made it.
        ...chain(() => ({ data: table === 'item_credits' ? { id: 'lead-credit' } : null, error: null })),
        delete: () => ({
          eq: async (_: string, id: string) => (mockDeletes.push([table, [id]]), { error: null }),
          in: async (_: string, ids: string[]) => (mockDeletes.push([table, ids]), { error: mockHouseMade.deleteFails ? { message: 'no signal' } : null }),
        }),
        insert: (row: Record<string, unknown>) => {
          if (table === 'items' && row.item_type === 'ingredient') {
            mockIngredientInserts.push(row);
            if (mockTakenNames.has(row.name as string)) return chain(() => ({ data: null, error: { code: 'P0001', message: 'taken', hint: TAKEN_ID } }));
          }
          if (table !== 'items') mockOtherInserts.push([table, row]);
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
const saveCalls = () => mockRpcs.filter(([fn]) => fn === 'save_drink');
const lastSave = () => saveCalls().at(-1)![1].p_save as Saved;

test('a picked ingredient merged away since is saved by its name, not its old id', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  const line = (id: string, name: string) => ({ key: id, id, name, amount: '20', unit: 'ml' });
  await run({
    draft: { ...EMPTY_DRAFT, name: 'Sour', creator: 'nobody', lines: [line('lime', 'Lime'), line('gone', 'Cupuacu')], methods: [{ id: 'shake', name: 'Shake' }] },
    barId: null,
    myProfileId: null,
  });
  const save = lastSave();
  expect(save.lines.map((l) => l.ingredient)).toEqual([{ id: 'lime', name: 'Lime' }, { name: 'Cupuacu', allergens: [] }]);
  expect(save.methods).toEqual(['shake']);
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
  // Sent under its draft id once; the database gives it one of its own.
  expect(id).toBe('db-made');
  expect(mockInserts.map((r) => r.id)).toEqual(['draft-2']);
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

const houseMadeCalls = () => mockRpcs.filter(([fn]) => fn === 'save_house_mades');

test('a house-made written in the drink saves with it, in one save_drink call, and the line uses it', async () => {
  mockRpcs.length = 0;
  mockSaveSpec.mockClear();
  mockSavePrepCard.mockClear();
  mockSavePrepRecipe.mockClear();
  mockIngredientInserts.length = 0;
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const prep = startPrep('shrub', 'Pineapple chili shrub');
  const { created } = await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, id: 'd-heat', name: 'Pineapple Heat', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Pineapple chili shrub', amount: '20', unit: 'ml', prep }] },
    barId: 'bar-1',
    myProfileId: null,
  });
  expect(houseMadeCalls()).toHaveLength(0);
  expect(saveCalls()).toHaveLength(1);
  const [, args] = saveCalls()[0];
  // Its key is the draft's id, kept on the device until the save goes through.
  expect(args.p_key).toBe('d-heat');
  const save = args.p_save as Saved;
  expect(save.bar).toBe('bar-1');
  expect(save.preps.map((p) => p.name)).toEqual(['Pineapple chili shrub']);
  expect(save.lines.map((l) => l.ingredient)).toEqual([{ house_made: 0 }]);
  expect(save.drink).toMatchObject({ id: 'd-heat', name: 'Pineapple Heat', item_type: 'cocktail', bar_id: 'bar-1' });
  // Nothing row by row, no spec call of its own, and no technique card.
  expect(mockSaveSpec).not.toHaveBeenCalled();
  expect(mockIngredientInserts).toHaveLength(0);
  expect(mockSavePrepRecipe).not.toHaveBeenCalled();
  expect(mockSavePrepCard).not.toHaveBeenCalled();
  expect(created).toEqual([{ id: 'made-0', name: 'Pineapple chili shrub' }]);
});

test('a save the database refuses leaves nothing to take out, and the draft as it was', async () => {
  mockDeletes.length = 0;
  mockHouseMade.refuse = 'Cupuacu is taken here';
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const draft: WizardDraft = { ...EMPTY_DRAFT, name: 'Cupuacu Sour', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Cupuacu', amount: '20', unit: 'ml', prep: startPrep('other', 'Cupuacu') }] };
  const e = await result.current.mutationFn({ draft, barId: 'bar-1', myProfileId: null }).catch((x: unknown) => x);
  mockHouseMade.refuse = null;
  expect(e).toMatchObject({ message: 'Cupuacu is taken here' });
  expect(mockDeletes).toEqual([]);
  expect(linesOnKeptHouseMades(e, draft)).toBeNull();
});

const pineDraft = (id: string): WizardDraft => ({ ...EMPTY_DRAFT, id, name: 'Pine Sour', creator: 'nobody', lines: [{ key: 'a', id: null, name: 'Pine syrup', amount: '20', unit: 'ml', prep: startPrep('syrup', 'Pine syrup') }] });

test('the connection drops on the save: trying again sends the same save under the same key, so the database hands back the same rows', async () => {
  mockRpcs.length = 0;
  mockDeletes.length = 0;
  mockHouseMade.drops = true;
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const draft = pineDraft('d-drops');
  const e = await result.current.mutationFn({ draft, barId: 'bar-1', myProfileId: null }).catch((x: unknown) => x);
  mockHouseMade.drops = false;
  expect(e).toBeInstanceOf(TypeError);
  expect(mockDeletes).toEqual([]);
  await result.current.mutationFn({ draft, barId: 'bar-1', myProfileId: null });
  const [first, again] = saveCalls();
  expect(again[1]).toEqual(first[1]);
  expect(first[1].p_key).toBe('d-drops');
});

test('Bring in’s Update it: the house-mades save first, and a spec the drink refuses takes them out again', async () => {
  mockRpcs.length = 0;
  mockDeletes.length = 0;
  mockSaveSpec.mockClear();
  mockSaveSpec.mockRejectedValueOnce(new Error('spec refused'));
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const draft = { ...pineDraft('d-update'), methods: [{ id: 'shake', name: 'Shake' }] };
  const e = await result.current.mutationFn({ draft, barId: 'bar-1', myProfileId: null, updateId: 'drink-1' }).catch((x: unknown) => x);
  expect(e).toMatchObject({ message: 'spec refused' });
  expect(houseMadeCalls()).toHaveLength(1);
  expect(saveCalls()).toHaveLength(0);
  expect(mockDeletes).toEqual([['items', ['made-0']]]);
  expect(linesOnKeptHouseMades(e, draft)).toBeNull();
  // It goes through: the drink takes the spec on the house-made's row.
  const { id } = await result.current.mutationFn({ draft, barId: 'bar-1', myProfileId: null, updateId: 'drink-1' });
  expect(id).toBe('drink-1');
  expect(mockSaveSpec.mock.calls.at(-1)[0]).toBe('drink-1');
  expect(mockSaveSpec.mock.calls.at(-1)[1].map((l: { ingredient_item_id: string }) => l.ingredient_item_id)).toEqual(['made-0']);
});

test('a house prep made for the finish saves with the drink too, as 3 drops after the pours', async () => {
  mockRpcs.length = 0;
  mockSaveSpec.mockClear();
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const prep = startPrep('other', 'Mint oil');
  await result.current.mutationFn({
    draft: {
      ...EMPTY_DRAFT,
      name: 'Coconut Fat-Washed Daiquiri',
      creator: 'nobody',
      lines: [{ key: 'a', id: 'lime', name: 'Lime', amount: '30', unit: 'ml' }],
      garnishes: [{ key: 'f', id: null, name: 'Mint oil', amount: '3', unit: 'drop', prep, technique: 'infused-oil' }],
    },
    barId: null,
    myProfileId: null,
  });
  const save = lastSave();
  expect(save.preps.map((p) => p.name)).toEqual(['Mint oil']);
  expect(save.lines.map((l) => [l.ingredient, l.amount, l.unit])).toEqual([[{ id: 'lime', name: 'Lime' }, 30, 'ml'], [{ house_made: 0 }, 3, 'drop']]);
});

const credited = () => mockRpcs.filter(([fn]) => fn === 'set_drink_credits' || fn === 'answer_item_credit');

test('at home, where and when it was first made are saved; another bar on it is a suggestion', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  mockInserts.length = 0;
  mockRpcs.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, id: 'd-attaboy', name: 'Ash Garden', originYear: 2019, place: { id: 'bar-p-attaboy', name: 'Attaboy' } }, barId: null, myProfileId: 'p-me' });
  expect(mockInserts[0]).toMatchObject({ origin_year: 2019, origin_bar_profile_id: 'bar-p-attaboy' });
  // Who made it is set apart (item_credits) in the same call, and you stay suggested while another bar is named.
  expect(lastSave().credits).toEqual({ creator: 'p-me', names: [], accept: false });
  expect(credited()).toEqual([]);

  mockRpcs.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, id: 'd-home', name: 'Ash Garden', originYear: 2019 }, barId: null, myProfileId: 'p-me' });
  expect(mockInserts[1]).toMatchObject({ origin_year: 2019, origin_bar_profile_id: null });
  // Your own credit: you say yes to it at once.
  expect(lastSave().credits).toEqual({ creator: 'p-me', names: [], accept: true });
});

test('someone with no page is saved by name (tf-063); nobody credited saves no credit', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  mockRpcs.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, id: 'd-craddock', name: 'Corpse Reviver No. 2', creator: { id: null, name: 'Harry Craddock' } }, barId: null, myProfileId: 'p-me' });
  expect(lastSave().credits).toEqual({ creator: null, names: ['Harry Craddock'], accept: false });
  mockRpcs.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, name: 'Ash Garden', creator: 'nobody' }, barId: null, myProfileId: 'p-me' });
  expect(lastSave().credits).toEqual({ creator: null, names: [], accept: false });
  expect(credited()).toEqual([]);
});

test('people made with are asked through the same call, after the drink is saved', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  mockRpcs.length = 0;
  await result.current.mutationFn({
    draft: { ...EMPTY_DRAFT, id: 'd-with', name: 'Ash Garden', creator: { id: 'p-sam', name: 'Sam Ross' }, coCreators: [{ id: 'p-kit', name: 'Kit Lee' }, { id: 'p-sam', name: 'Sam Ross' }] },
    barId: null,
    myProfileId: 'p-me',
  });
  expect(lastSave().credits).toEqual({ creator: 'p-sam', names: [], accept: false });
  expect(credited()).toEqual([['set_drink_credits', { p_item_id: 'd-with', p_creator_profile_id: 'p-sam', p_creator_names: [], p_add: ['p-kit'], p_remove: [] }]]);
});

test('"Just me" notes are kept apart as yours, never on the drink', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  mockInserts.length = 0;
  mockOtherInserts.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, id: 'd-private', name: 'Ash Garden', notes: ' Less agave next time. ', notesPrivate: true }, barId: null, myProfileId: null });
  expect('notes' in mockInserts[0]).toBe(false);
  expect(mockOtherInserts).toContainEqual(['item_private_notes', { item_id: 'd-private', body: 'Less agave next time.' }]);
  expect(mockOtherInserts.filter(([t]) => t === 'item_notes')).toHaveLength(0);

  await run({ draft: { ...EMPTY_DRAFT, name: 'Ash Garden', notes: 'Dry shake hard.', notesPrivate: false }, barId: null, myProfileId: null });
  expect(mockOtherInserts).toContainEqual(['item_notes', { item_id: 'db-made', body: 'Dry shake hard.', read_level: null }]);
  expect(mockOtherInserts.filter(([t]) => t === 'item_private_notes')).toHaveLength(1);
});

test('at a venue the notes go to the picked role and up; at home always to everyone (E29)', async () => {
  const { result } = await renderHook(() => useCreateDrink() as unknown as { mutationFn: Fn });
  const run = result.current.mutationFn;
  mockOtherInserts.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, name: 'Ash Garden', notes: 'Aquafaba: full 15 seconds.', notesLevel: 35 }, barId: 'bar-1', myProfileId: null });
  expect(mockOtherInserts).toContainEqual(['item_notes', { item_id: 'db-made', body: 'Aquafaba: full 15 seconds.', read_level: 35 }]);

  mockOtherInserts.length = 0;
  await run({ draft: { ...EMPTY_DRAFT, name: 'Ash Garden', notes: 'Stir longer.', notesLevel: 35, notesPrivate: false }, barId: null, myProfileId: null });
  expect(mockOtherInserts).toContainEqual(['item_notes', { item_id: 'db-made', body: 'Stir longer.', read_level: null }]);
});

// A draft saved with no signal stays in Add until its save lands, wherever the person is by then (the wizard closed or reopened).
describe('once a waiting save is in', () => {
  const qc = { getMutationCache: () => ({ findAll: () => [], remove: jest.fn() }) } as never;
  const result = { id: 'd1', warnings: [], created: [], later: [] };

  test('the draft it came from goes, even picked up again since', () => {
    useDrinkWizardStore.getState().patch('bar-1', { id: 'd1', name: 'Pine Fizz' });
    const kept = useDrinkWizardStore.getState().kept['bar-1'].draft;
    newDrinkSaved(qc, result, { draft: { ...EMPTY_DRAFT, ...kept }, barId: 'bar-1', myProfileId: null, keptPrint: specFingerprint(kept) });
    expect(useDrinkWizardStore.getState().kept['bar-1']).toBeUndefined();
  });

  test('changed since Save, it stays with a fresh id: nothing typed is lost, and saving it makes a drink', () => {
    useDrinkWizardStore.getState().patch('bar-1', { id: 'd1', name: 'Pine Fizz' });
    const kept = useDrinkWizardStore.getState().kept['bar-1'].draft;
    const keptPrint = specFingerprint(kept);
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Pine Fizz No. 2' });
    newDrinkSaved(qc, result, { draft: { ...EMPTY_DRAFT, ...kept }, barId: 'bar-1', myProfileId: null, keptPrint });
    const now = useDrinkWizardStore.getState().kept['bar-1']?.draft;
    expect(now?.name).toBe('Pine Fizz No. 2');
    expect(now?.id).not.toBe('d1');
  });
});
