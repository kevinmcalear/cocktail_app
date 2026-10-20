import { renderHook } from '@testing-library/react-native';

import { useIngredientDraftEditor } from '@/hooks/useIngredientEditor';

type Drafts = { drafts: { id: string; entity_type: string; draft_data: Record<string, unknown>; bar_id: string | null }[]; isFetching: boolean; loaded: boolean; failed?: { retry: () => void } | null };
let mockDrafts: Drafts;
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ ...mockDrafts, saveDraft: jest.fn(), deleteDraft: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: undefined }), refreshIngredients: jest.fn() }));
jest.mock('@/hooks/useIngredients', () => ({ useIngredient: () => ({ data: undefined }) }));
jest.mock('@/hooks/useTrackRecent', () => ({ recentEntry: () => ({}), useTrackRecent: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
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
