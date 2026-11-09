import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// "Did you mean" in the ingredient search (whole-app canvas, Search page, 2A). Pairings come from the database; these tests are about the field.
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
// Close names the database finds: Green Chartreuse for "chartruse"; "chartroos" it is still working on.
jest.mock('@/hooks/useSearchNear', () => ({
  useSearchNear: (q: string) => ({ data: q.trim().toLowerCase() === 'chartruse' ? [{ id: 'gc', kind: 'ingredient' }] : [], asking: q.trim().toLowerCase() === 'chartroos' }),
}));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }), useCloseClassics: () => ({ data: [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDebounced: <T,>(v: T) => v, useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const CAMPARI = { id: 'campari', name: 'Campari' };

describe('IngredientSearch, Did you mean', () => {
  test('a slip asks Did you mean: tapping it picks it, the add rows sit under No, and Return adds nothing new', async () => {
    const set = jest.fn();
    const GREEN = { id: 'gc', name: 'Green Chartreuse' };
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI, GREEN]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'chartruse');
    expect(screen.getByText('Did you mean')).toBeTruthy();
    // Where it's from, then how to take it (board q16-2, canvas 2A).
    expect(screen.getByText('In the catalog · tap to use it')).toBeTruthy();
    expect(screen.queryByText('No bottle by that name.')).toBeNull();
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Green Chartreuse')).toBeLessThan(rows.indexOf('Make “Chartruse” in-house'));
    expect(screen.getByText('No, it’s something else')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Green Chartreuse' }));
    expect(set).toHaveBeenCalledWith({ lines: [expect.objectContaining({ id: 'gc', name: 'Green Chartreuse' })] });
  });

  test('Looking… until the database answers, or 1.5 s after the last letter, before No bottle by that name', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'chartroos');
    expect(screen.getByText('Looking…')).toBeTruthy();
    expect(screen.queryByText('No bottle by that name.')).toBeNull();
    await act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByText('No bottle by that name.')).toBeTruthy();
    // Answered with nothing close: not there, at once.
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'zzqx bottle');
    expect(screen.queryByText('Looking…')).toBeNull();
    expect(screen.getByText('No bottle by that name.')).toBeTruthy();
    jest.useRealTimers();
  });

});
