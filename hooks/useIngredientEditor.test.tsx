import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useIngredientDraftEditor, useIngredientEditor } from '@/hooks/useIngredientEditor';
import type { MockDb } from '@/jest.supabaseMock';

type Drafts = { drafts: { id: string; entity_type: string; draft_data: Record<string, unknown>; bar_id: string | null }[]; isFetching: boolean; loaded: boolean; failed?: { retry: () => void } | null };
let mockDrafts: Drafts;
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ ...mockDrafts, saveDraft: jest.fn(), deleteDraft: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: undefined }), refreshIngredients: jest.fn() }));
let mockIngredient: unknown;
jest.mock('@/hooks/useIngredients', () => ({ useIngredient: () => ({ data: mockIngredient }) }));
jest.mock('@/lib/editableRecipes', () => ({ fetchEditableRecipes: async () => [] }));
jest.mock('@/hooks/useTrackRecent', () => ({ recentEntry: () => ({}), useTrackRecent: jest.fn() }));
const mockDb: MockDb = { rows: {}, calls: [] };
jest.mock('@/lib/supabase', () => jest.requireActual('@/jest.supabaseMock').mockSupabase(() => mockDb));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));

const DRAFT = { id: 'd1', entity_type: 'ingredient', draft_data: { name: 'Honey water', description: '2:1 honey to water' }, bar_id: null };

describe('useIngredientDraftEditor', () => {
  it('waits for the drafts to arrive before filling the form', async () => {
    // Opened from a link: auth hasn't the user yet, so the drafts query sits idle and empty.
    mockDrafts = { drafts: [], isFetching: false, loaded: false };
    const { result, rerender } = await renderHook(() => useIngredientDraftEditor({ draftId: 'd1' }));
    expect(result.current.loading).toBe(true);

    mockDrafts = { drafts: [], isFetching: true, loaded: false };
    await rerender({});
    expect(result.current.loading).toBe(true);

    mockDrafts = { drafts: [DRAFT], isFetching: false, loaded: true };
    await rerender({});
    expect(result.current.loading).toBe(false);
    expect(result.current.form.name).toBe('Honey water');
    expect(result.current.form.description).toBe('2:1 honey to water');
  });

  it('opens an empty draft once the drafts are in and it is not among them', async () => {
    mockDrafts = { drafts: [], isFetching: false, loaded: true };
    const { result } = await renderHook(() => useIngredientDraftEditor({ draftId: 'new', initialName: 'orgeat' }));
    expect(result.current.loading).toBe(false);
    expect(result.current.form.name).toBe('Orgeat');
  });

  it('stays unfilled and reports the failure when the drafts could not be fetched', async () => {
    const failed = { retry: jest.fn() };
    mockDrafts = { drafts: [], isFetching: false, loaded: false, failed };
    const { result } = await renderHook(() => useIngredientDraftEditor({ draftId: 'd1' }));
    // Opening it empty would let Save draft wipe the saved draft.
    expect(result.current.loading).toBe(true);
    expect(result.current.draftsFailed).toBe(failed);
  });
});

describe('useIngredientEditor', () => {
  // As app_item_presentation shows it; the tags and levels come from items.
  const INGREDIENT = { id: 'i1', name: 'Gin', description: '', brand_maker: null, generic: null, abv: 40, bar_id: null, hide_from_search: false, ingredient_role: 'style' };
  const LEVELS = { override_visibility_level: 20, override_generic_ingredient_level: null, override_specific_brand_level: null, override_measurement_level: null, override_prep_level: null };

  async function openGin() {
    mockDrafts = { drafts: [], isFetching: false, loaded: true };
    mockIngredient = { ingredient: INGREDIENT, recipe: [] };
    mockDb.rows = { items: { ...LEVELS, item_categories: [{ category_id: 'london-dry' }, { category_id: 'juniper' }] } };
    const view = await renderHook(() => useIngredientEditor('i1'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    mockDb.calls = [];
    return view;
  }
  const tagWrites = () => mockDb.calls.filter((c) => c.table === 'item_categories' && c.op !== 'select');

  it('opens with the saved tags ticked', async () => {
    const { result } = await openGin();
    expect(result.current.form.selectedCategories).toEqual(['london-dry', 'juniper']);
    expect(result.current.form.overrideVisibility).toBe('20');
  });

  it('saving without changes unlinks no tags and writes no columns', async () => {
    const { result } = await openGin();
    await act(async () => {
      expect(await result.current.save()).toBe(true);
    });
    expect(tagWrites()).toEqual([]);
    expect(mockDb.calls.filter((c) => c.table === 'items' && c.op !== 'select')).toEqual([]);
  });

  it('a change writes only that column', async () => {
    const { result } = await openGin();
    await act(() => result.current.set({ brandMaker: 'tanqueray' }));
    await act(async () => {
      await result.current.save();
    });
    expect(mockDb.calls.filter((c) => c.table === 'items' && c.op === 'update')).toEqual([{ table: 'items', op: 'update', payload: { brand_maker: 'Tanqueray' }, filters: [['id', 'i1']] }]);
  });

  it('unticking a tag unlinks only that one, never a tag it did not load', async () => {
    const { result } = await openGin();
    // A tag linked elsewhere since the editor opened.
    mockDb.rows.item_categories = [{ category_id: 'london-dry' }, { category_id: 'juniper' }, { category_id: 'added-elsewhere' }];
    await act(() => result.current.set({ selectedCategories: ['london-dry', 'citrus'] }));
    await act(async () => {
      await result.current.save();
    });
    expect(tagWrites()).toEqual([
      { table: 'item_categories', op: 'delete', payload: undefined, filters: [['item_id', 'i1'], ['category_id', ['juniper']]] },
      { table: 'item_categories', op: 'upsert', payload: [{ item_id: 'i1', category_id: 'citrus', is_primary: true }], filters: [] },
    ]);
  });
});
