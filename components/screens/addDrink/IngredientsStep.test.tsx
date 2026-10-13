import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import { startPrep } from '@/lib/prepKinds';

import { IngredientsStep } from './IngredientsStep';

// Pairings come from the database; these tests are about the field.
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: (id: string | null) => ({ data: id === 'campari' ? 14 : 0 }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));

// The prep builder draws after its first layout, as the wizard does on iOS.
const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const CAMPARI = { id: 'campari', name: 'Campari', item_images: [{ images: { url: 'https://example.test/campari.jpg' } }] };

describe('IngredientsStep', () => {
  test('while the list loads, a typed name is never added as a new ingredient', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[]} loading />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');

    expect(screen.getByText('Loading ingredients…')).toBeTruthy();
    expect(screen.queryByText('Just add the name')).toBeNull();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
  });

  test('once loaded, it finds the bottle and still offers a new one', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');

    expect(screen.getByRole('button', { name: 'Just add the name “camp”' })).toBeTruthy();
    // How much it's used, under its name.
    expect(screen.getByText('In 14 drinks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari' });
  });

  test('a prep the shelf lacks is made in house from a technique: the line carries its recipe', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Clarified grapefruit');

    await fireEvent.press(screen.getByRole('button', { name: 'Make “Clarified grapefruit” in house' }));
    await laidOut();
    await fireEvent.press(screen.getByRole('radio', { name: /^Quick agar clarifying/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to the drink' }));
    const line = set.mock.calls[0][0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Clarified Grapefruit', technique: 'agar-quick' });
    expect(line.prep.technique).toBe('agar-quick');
    expect(line.prep.lines.length).toBeGreaterThan(1);
  });

  test('a shrub starts from its name: the fruit as the base, equal parts, a cold method', async () => {
    const set = jest.fn();
    const onNotice = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, name: 'Pineapple Heat' }} set={set} ingredients={[CAMPARI]} onNotice={onNotice} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Pineapple chili shrub');
    await fireEvent.press(screen.getByRole('button', { name: 'Make “Pineapple chili shrub” in house' }));
    await laidOut();

    expect(screen.getByRole('radio', { name: 'Shrub, Fruit, sugar, vinegar, from the name', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    expect(screen.getByText('Pineapple')).toBeTruthy();
    expect(screen.getByText('The base, everything follows it')).toBeTruthy();
    expect(screen.getByText('SHRUB, COLD · EQUAL PARTS BY WEIGHT')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Pineapple Heat' }));
    const prep = set.mock.calls[0][0].lines[0].prep;
    expect(prep.kind).toBe('shrub');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Pineapple', 'Sugar', 'Apple cider vinegar', 'Chili']);
    expect(prep.leadMinutes).toBe(3 * 24 * 60);
    // Back in the drink: over the footer, it says the prep is saved with the drink.
    expect(onNotice).toHaveBeenCalledWith('Shrub saved to your preps when you save the drink. Its page is ready then.');
  });

  test('a prep can be left for later: the name now, its recipe to write, and the line offers it', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.queryByText('Nothing called that yet. Closest:')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Just add the name “pineapple chili shrub”' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: null, name: 'Pineapple Chili Shrub', later: true });

    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, lines: set.mock.calls[0][0].lines }} set={set} ingredients={[CAMPARI]} />);
    expect(screen.getByText('House prep, recipe to write')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write the recipe for Pineapple Chili Shrub' })).toBeTruthy();
  });

  test('nothing called that: the closest ingredients, then make it or just add the name', async () => {
    const PINEAPPLE = { id: 'pj', name: 'Pineapple Juice' };
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI, PINEAPPLE]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'pineapple chili shrub');
    expect(screen.getByText('Nothing called that yet. Closest:')).toBeTruthy();
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Pineapple Juice')).toBeLessThan(rows.indexOf('Make “Pineapple chili shrub” in house'));
    expect(rows.indexOf('Make “Pineapple chili shrub” in house')).toBeLessThan(rows.indexOf('Just add the name “pineapple chili shrub”'));
  });

  test('an ordinary new name is added by name first, and can still be made in house', async () => {
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Yuzu juice');
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Just add the name “Yuzu juice”')).toBeLessThan(rows.indexOf('Make “Yuzu juice” in house'));
  });

  test('a name that exists can still be made your own', async () => {
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Campari');
    expect(screen.queryByRole('button', { name: /^Just add the name/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Make “Campari” in house' })).toBeTruthy();
    expect(screen.getByText('Return takes the top one. Make is still here: one of your own is saved as yours, next to the one you have.')).toBeTruthy();
  });

  test('swapping a house-made line for a bottle drops its recipe; a swap can be made in house too', async () => {
    const set = jest.fn();
    const prep = startPrep('other', 'Mint oil');
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'a', id: null, name: 'Mint oil', amount: '', unit: 'drop', prep }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Mint oil, / }));
    await fireEvent.changeText(screen.getByLabelText('Swap Mint oil for…'), 'Campari');
    expect(screen.getByRole('button', { name: 'Make “Campari” in house' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(set.mock.calls[0][0].lines[0]).toMatchObject({ id: 'campari', name: 'Campari', prep: undefined, technique: undefined });
  });

  const BACARDI = { id: 'bacardi', name: 'Bacardí Carta Blanca', generic_id: 'white-rum' };
  const WHITE_RUM = { id: 'white-rum', name: 'White Rum' };
  const daiquiri = { ...EMPTY_DRAFT, name: 'Coconut Fat-Washed Daiquiri', lines: [{ key: 'a', id: 'bacardi', name: 'Bacardí Carta Blanca', amount: '60', unit: 'ml' }] };

  test('the drink’s name says how the rum is made: one tap makes it house, on the real bottle', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={daiquiri} set={set} ingredients={[CAMPARI, BACARDI, WHITE_RUM]} />);
    expect(screen.getByText('The name says coconut fat-washed. Make the Bacardí Carta Blanca that way?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Make it house' }));
    await laidOut();
    // Straight to the recipe: the bottle is the base, the fat is coconut oil.
    expect(screen.getByLabelText('Bacardí Carta Blanca. Swap it')).toBeTruthy();
    expect(screen.getByLabelText('Coconut Oil. Swap it')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Coconut Fat-Washed Daiquiri' }));
    const line = set.mock.calls.at(-1)[0].lines[0];
    expect(line).toMatchObject({ id: null, name: 'Coconut fat-washed Bacardí Carta Blanca', technique: 'fat-wash' });
    expect(line.prep.madeFrom).toEqual({ id: 'bacardi', name: 'Bacardí Carta Blanca' });
  });

  test('any spirit line can be made house: what did you do to it?', async () => {
    await renderWithTamagui(<IngredientsStep draft={{ ...daiquiri, name: 'Daiquiri' }} set={jest.fn()} ingredients={[CAMPARI, BACARDI, WHITE_RUM]} />);
    expect(screen.queryByText(/The name says/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Make Bacardí Carta Blanca house/ }));
    expect(screen.getByText('What did you do to it?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Fat washing,/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Simple and rich syrup,/ })).toBeNull();
  });

  test('a line that isn’t a spirit or juice has no Make it house', async () => {
    const draft = { ...EMPTY_DRAFT, lines: [{ key: 'c', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' }] };
    await renderWithTamagui(<IngredientsStep draft={draft} set={jest.fn()} ingredients={[CAMPARI]} />);
    expect(screen.getByRole('button', { name: /^Make Campari house/ })).toBeTruthy();
    const plain = { ...EMPTY_DRAFT, lines: [{ key: 's', id: 'syrup', name: 'Simple syrup', amount: '15', unit: 'ml' }] };
    await renderWithTamagui(<IngredientsStep draft={plain} set={jest.fn()} ingredients={[{ id: 'syrup', name: 'Simple syrup' }]} />);
    expect(screen.queryByRole('button', { name: /^Make Simple syrup house/ })).toBeNull();
  });
});

