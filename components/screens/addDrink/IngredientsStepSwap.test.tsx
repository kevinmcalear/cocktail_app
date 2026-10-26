import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// Pairings come from the database; these tests are about the field.
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: (id: string | null) => ({ data: id === 'campari' ? 14 : 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const CAMPARI = { id: 'campari', name: 'Campari', item_images: [{ images: { url: 'https://example.test/campari.jpg' } }] };

// Swap opens its search with the line's name typed: a rename is a word away (Eddie, 26 Oct).
describe('IngredientsStep swap', () => {
  test('a swap starts with the line’s name, so it can be renamed and keeps its pour (Eddie, 26 Oct)', async () => {
    const set = jest.fn();
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'a', id: 'feijoa', name: 'Feijoa', amount: '30', unit: 'ml' }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={set} ingredients={[CAMPARI, { ...CAMPARI, id: 'feijoa', name: 'Feijoa' }]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Feijoa, / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Swap Feijoa for another ingredient' }));
    await fireEvent.changeText(screen.getByLabelText('Rename Feijoa or pick another'), 'Feijoa juice');
    await fireEvent.press(screen.getByRole('button', { name: 'Just add the name “Feijoa juice”' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ key: 'a', id: null, name: 'Feijoa juice', named: true, amount: '30', unit: 'ml' });
  });

  test('Return on a swap left as it was keeps the line, not the top match', async () => {
    const set = jest.fn();
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'a', id: null, name: 'Feijoa', amount: '30', unit: 'ml', named: true }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={set} ingredients={[{ ...CAMPARI, id: 'fv', name: 'Feijoa Vodka' }]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Feijoa, / }));
    await fireEvent.press(screen.getByRole('button', { name: 'Swap Feijoa for another ingredient' }));
    await fireEvent(screen.getByLabelText('Rename Feijoa or pick another'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Rename Feijoa or pick another')).toBeNull();
  });
});
