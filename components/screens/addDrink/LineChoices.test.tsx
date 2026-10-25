import { fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, newLine } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// Pairings come from the database; these tests are about the line.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const MEZCAL = { id: 'mezcal', name: 'Mezcal' };
const draftWith = (...names: (string | { id: string; name: string })[]) => ({
  ...EMPTY_DRAFT,
  name: 'Salty Boy',
  lines: names.map((n) => newLine(typeof n === 'string' ? { id: null, name: n } : n, 'ml', '15')),
});
const labels = (group: ReturnType<typeof screen.getByLabelText>) => within(group).getAllByRole('button').map((b) => b.props.accessibilityLabel as string);

describe('A line that matched nothing (owner-setup-path, step 10)', () => {
  test('says "house": Make it in-house first, and it opens the recipe by its name without "house"', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={draftWith(MEZCAL, 'House miso banana liqueur')} set={set} ingredients={[MEZCAL]} venueName="Little Rye" />);

    const group = screen.getByLabelText('What House miso banana liqueur is');
    expect(within(group).getByText('Not at Little Rye yet. It says “house”, so:')).toBeTruthy();
    expect(labels(group)).toEqual(['Make Miso banana liqueur in-house', 'House miso banana liqueur is a bottle we buy', 'Just the name: House miso banana liqueur']);
    // A line already in the catalog asks nothing.
    expect(screen.queryByLabelText('What Mezcal is')).toBeNull();

    await fireEvent.press(within(group).getByRole('button', { name: 'Make Miso banana liqueur in-house' }));
    await fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
    expect(screen.getByLabelText('Name').props.value).toBe('Miso banana liqueur');
    // Its flavours from the name, a line each (PR #837), one level down from Salty Boy.
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByLabelText('Add a note to Miso')).toBeTruthy();
    expect(screen.getByLabelText('Add a note to Banana')).toBeTruthy();
    expect(screen.getByText('For Salty Boy')).toBeTruthy();
  });

  test('says nothing about house: A bottle we buy first, and it marks the line a bottle', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={draftWith('Yuzu sake')} set={set} ingredients={[MEZCAL]} venueName="Little Rye" />);

    const group = screen.getByLabelText('What Yuzu sake is');
    expect(within(group).getByText('Not at Little Rye yet. What is it?')).toBeTruthy();
    expect(labels(group)[0]).toBe('Yuzu sake is a bottle we buy');
    await fireEvent.press(within(group).getByRole('button', { name: 'Yuzu sake is a bottle we buy' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Yuzu sake', bottle: { abv: '' } });
  });

  test('Just the name: a plain name stops asking, a house one is a recipe to write later', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={draftWith('Yuzu sake', 'House miso banana liqueur')} set={set} ingredients={[MEZCAL]} />);

    // At home there's no venue to name, and the bottle is mine.
    expect(screen.getAllByText('Nothing called that yet. What is it?').length).toBe(1);
    expect(screen.getByRole('button', { name: 'Yuzu sake is a bottle I buy' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Just the name: Yuzu sake' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ name: 'Yuzu sake', named: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Just the name: House miso banana liqueur' }));
    expect(set.mock.calls[1][0].lines[1]).toMatchObject({ name: 'House miso banana liqueur', later: true });
  });

  test('"Just add the name" in the search has already said: its line asks nothing', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[MEZCAL]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Yuzu sake');
    await fireEvent.press(screen.getByRole('button', { name: 'Just add the name “Yuzu sake”' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Yuzu sake', named: true });
  });
});
