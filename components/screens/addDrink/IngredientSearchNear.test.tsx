import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// "Did you mean" in the ingredient search (whole-app canvas, Search page, 2A). Pairings come from the database; these tests are about the field.
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
// Close names the database finds: Green Chartreuse for "chartruse".
jest.mock('@/hooks/useSearchNear', () => ({ useSearchNear: (q: string) => ({ data: q.trim().toLowerCase() === 'chartruse' ? [{ id: 'gc', kind: 'ingredient' }] : [] }) }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: (id: string | null) => ({ data: id === 'campari' ? 14 : 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const CAMPARI = { id: 'campari', name: 'Campari' };

describe('IngredientSearch, Did you mean', () => {
  test('a slip asks Did you mean: tapping it picks it, the add rows sit under No, and Return adds nothing new', async () => {
    const set = jest.fn();
    const GREEN = { id: 'gc', name: 'Green Chartreuse' };
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI, GREEN]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'chartruse');
    expect(screen.getByText('Did you mean')).toBeTruthy();
    expect(screen.getByText('Tap to use it')).toBeTruthy();
    expect(screen.queryByText('No bottle by that name.')).toBeNull();
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Green Chartreuse')).toBeLessThan(rows.indexOf('Make “Chartruse” in-house'));
    expect(screen.getByText('No, it’s something else')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Green Chartreuse' }));
    expect(set).toHaveBeenCalledWith({ lines: [expect.objectContaining({ id: 'gc', name: 'Green Chartreuse' })] });
  });

});
