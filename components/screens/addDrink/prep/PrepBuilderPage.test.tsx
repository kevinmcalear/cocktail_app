import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { PrepBuilder } from './PrepBuilder';

// New > Something you make (board Add-house, with Kevin's 8 Nov picks): the builder on its own page.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));

const laidOut = () => fireEvent(screen.getByTestId('add-prep'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

describe('PrepBuilder on its own page', () => {
  test('on its own page (board Add-house): the X, nothing picked until named, the main button alone, and Save it', async () => {
    const onDone = jest.fn();
    const onKeep = jest.fn();
    const onClose = jest.fn();
    const onDrop = jest.fn();
    await renderWithProviders(<PrepBuilder page name="" drinkName="" above={[]} ingredients={[]} onDone={onDone} onKeep={onKeep} onDrop={onDrop} onClose={onClose} />);
    await laidOut();
    expect(screen.getByText('Something you make')).toBeTruthy();
    expect(screen.getByText('HOUSE-MADE · 1 OF 3')).toBeTruthy();
    // Nothing picked yet: the kit question waits (Kevin, 8 Nov: "Five + More").
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.getByText('Ways to make it show once you pick what it is, your kit first.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: what goes in' })).toBeDisabled();
    // Closed with nothing written: it just goes.
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onDrop).toHaveBeenCalled();
    // The name says the kind: picked as it's typed.
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Honey syrup');
    expect(screen.getByRole('radio', { name: 'Syrup', checked: true })).toBeTruthy();
    expect(screen.getByText('From the name')).toBeTruthy();
    expect(onKeep).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'syrup' }), 'Honey syrup', 'kind');
    // A syrup's ways as drawn (Kevin, 9 Nov: "Build as drawn"): Mix, Sous vide, Rotovap, kit first, the rest dimmed with I have this.
    expect(screen.getByText('HOW? YOUR KIT FIRST')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Mix\./, checked: true })).toBeTruthy();
    expect(screen.getByText('Warm the water, stir until it dissolves')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Sous vide\./ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Rotovap\./ })).toBeTruthy();
    expect(screen.getAllByText('Needs kit you haven’t added')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^I have this/ })).toHaveLength(2);
    expect(screen.queryByText(/FOR/)).toBeNull();
    // The main button alone (Kevin, 8 Nov: "Later on close").
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: what goes in' }));
    expect(screen.getByText('HONEY SYRUP · 2 OF 3')).toBeTruthy();
    // What goes in opens As measured (board Add-house, 2); Makes about opens how it's reached; no colour bar or caption under it.
    expect(screen.getByRole('radio', { name: 'As measured', checked: true })).toBeTruthy();
    expect(screen.queryByText(/is a guess from the weights/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Makes about/ }));
    expect(screen.getByText('A guess from the weights. Log your first batch and it uses the real number.')).toBeTruthy();
    // Close asks first, and what's written is kept.
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Leave it for now?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByText('Leave it for now?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: how it’s made' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: 'syrup' }), 'Honey syrup');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Leave it for now' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('on its own page a name taken here is one card, Open it or Rename this one, and Next waits', async () => {
    const onOpen = jest.fn();
    await renderWithProviders(<PrepBuilder page name="Honey syrup" drinkName="" above={[]} ingredients={[]} taken={{ title: 'Honey syrup is already here', body: 'Caretaker’s has one, in 3 drinks.', onOpen, openLabel: 'Open Honey syrup' }} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    expect(screen.getByText('Honey syrup is already here')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Syrup' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next: what goes in' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Honey syrup' }));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename this one' })).toBeTruthy();
  });

  test('at a bar the kit is in Settings › Kit, as drawn', async () => {
    await renderWithProviders(<PrepBuilder page name="Pine syrup" drinkName="" above={[]} ingredients={[]} bar={{ id: 'b1', name: 'Caretaker’s' }} onDone={jest.fn()} onClose={jest.fn()} />);
    await laidOut();
    expect(screen.getByText('Your kit is in Settings › Kit. The rest stay here, dimmed, in case you have it.')).toBeTruthy();
  });
});
