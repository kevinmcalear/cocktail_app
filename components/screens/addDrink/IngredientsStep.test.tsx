import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { IngredientsStep } from './IngredientsStep';

// Pairings come from the database; these tests are about the field.
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
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
    expect(screen.queryByText(/as new/)).toBeNull();
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'submitEditing');
    expect(set).not.toHaveBeenCalled();
  });

  test('once loaded, it finds the bottle and still offers a new one', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');

    expect(screen.getByRole('button', { name: /as new/ })).toBeTruthy();
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
    expect(line).toMatchObject({ id: null, name: 'Clarified grapefruit', technique: 'agar-quick' });
    expect(line.prep.technique).toBe('agar-quick');
    expect(line.prep.lines.length).toBeGreaterThan(1);
  });

  test('a shrub starts from its name: the fruit as the base, equal parts, a cold method', async () => {
    const set = jest.fn();
    await renderWithTamagui(<IngredientsStep draft={{ ...EMPTY_DRAFT, name: 'Pineapple Heat' }} set={set} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Pineapple chili shrub');
    await fireEvent.press(screen.getByRole('button', { name: 'Make “Pineapple chili shrub” in house' }));
    await laidOut();

    expect(screen.getByRole('radio', { name: 'Shrub, Fruit, sugar, vinegar, from the name', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: recipe' }));
    expect(screen.getByText('Pineapple')).toBeTruthy();
    expect(screen.getByText('The base')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: method' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add it to Pineapple Heat' }));
    const prep = set.mock.calls[0][0].lines[0].prep;
    expect(prep.kind).toBe('shrub');
    expect(prep.lines.map((l: { name: string }) => l.name)).toEqual(['Pineapple', 'Sugar', 'Apple cider vinegar', 'Chili']);
    expect(prep.leadMinutes).toBe(3 * 24 * 60);
  });

  test('an ordinary new name is added as new first, and can still be made in house', async () => {
    await renderWithTamagui(<IngredientsStep draft={EMPTY_DRAFT} set={jest.fn()} ingredients={[CAMPARI]} />);
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Yuzu juice');
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? b.props['aria-label']);
    expect(rows.indexOf('Add “Yuzu juice” as new')).toBeLessThan(rows.indexOf('Make “Yuzu juice” in house'));
  });
});
