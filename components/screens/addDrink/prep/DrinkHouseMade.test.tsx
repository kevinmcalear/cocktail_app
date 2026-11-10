import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { startPrep } from '@/lib/prepKinds';

import { DrinkHouseMade, type DrinkHouseMadeProps } from './DrinkHouseMade';

// A house-made written inside the drink (board Add-inside): one flat page, saved with the drink.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));
let mockConnected = true;
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockConnected }) }));
const mockSame = jest.fn((): unknown => null);
jest.mock('@/hooks/useSameNamePrep', () => ({ ...jest.requireActual('@/hooks/useSameNamePrep'), useSameNamePrep: () => ({ data: mockSame(), checking: false }) }));

const laidOut = () => fireEvent(screen.getByTestId('part-page'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

const props = (more: Partial<DrinkHouseMadeProps> = {}): DrinkHouseMadeProps => ({
  name: 'Pine syrup',
  initial: null,
  drinkName: 'Pine Fizz',
  forDrink: true,
  drafts: true,
  above: [{ label: 'Pine Fizz' }],
  bar: { id: 'b1', name: 'Little Rye' },
  ingredients: [],
  onKeep: jest.fn(),
  onDone: jest.fn(),
  onClose: jest.fn(),
  onUse: jest.fn(),
  ...more,
});

afterEach(() => {
  mockConnected = true;
  mockSame.mockReturnValue(null);
});

test('its name taken here: the one you have first (Use yours), a new one second', async () => {
  mockSame.mockReturnValue({ id: 'ps', name: 'Pine syrup', here: true, drinks: 3, made: null });
  const p = props();
  await renderWithProviders(<DrinkHouseMade {...p} />);
  await laidOut();
  expect(screen.getByText('You have a Pine syrup')).toBeTruthy();
  const buttons = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? b.props['aria-label'] ?? ''));
  expect(buttons.findIndex((l) => l.startsWith('Use yours'))).toBeLessThan(buttons.indexOf('Make a new one'));
  // Done waits while the name is taken.
  expect(screen.getByRole('button', { name: 'Done: Pine syrup goes in Pine Fizz' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: /^Use yours/ }));
  expect(p.onUse).toHaveBeenCalledWith('ps', 'Pine syrup');
});

test('offline it says the drink’s draft keeps it on this phone', async () => {
  mockConnected = false;
  await renderWithProviders(<DrinkHouseMade {...props()} />);
  await laidOut();
  expect(screen.getByText('You’re offline.')).toBeTruthy();
  expect(screen.getByText('It’s kept in the drink’s draft on this phone; nothing is lost.')).toBeTruthy();
  expect(screen.queryByText('Saves with the drink. It shows on House-made too.')).toBeNull();
});

test('Back with nothing written just closes; one finished before closes with its changes kept, no asking', async () => {
  // A name that says no kind starts with no lines.
  const p = props({ name: 'Rvwa' });
  await renderWithProviders(<DrinkHouseMade {...p} />);
  await laidOut();
  // Nothing in it yet (Add-inside, Empty).
  expect(screen.getByText('Nothing in it yet. Add what goes in, or come back to it: the drink shows Recipe to finish.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Fizz/ }));
  expect(screen.queryByText('Leave it for now?')).toBeNull();
  expect(p.onClose).toHaveBeenCalledWith(false);

  const again = props({ initial: startPrep('syrup', 'Pine syrup'), finished: true });
  await renderWithProviders(<DrinkHouseMade {...again} />);
  await laidOut();
  await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Spruce tips');
  await fireEvent.press(screen.getByRole('button', { name: /^Add “Spruce tips”$/ }));
  expect(again.onKeep).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Fizz/ }));
  expect(screen.queryByText('Leave it for now?')).toBeNull();
  expect(again.onClose).toHaveBeenCalledWith(true);
});

test('the check saves the drink with it, the page open, and says Saving… while it does (Add-inside, Saving with the drink)', async () => {
  const onSave = jest.fn();
  const p = props({ initial: startPrep('syrup', 'Pine syrup'), save: { onSave, saving: false, canSave: true } });
  await renderWithProviders(<DrinkHouseMade {...p} />);
  await laidOut();
  // Read from the name, and said so.
  expect(screen.getByText('Syrup · from the name')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done: save Pine Fizz with Pine syrup' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'syrup' }), 'Pine syrup');
  expect(p.onDone).not.toHaveBeenCalled();

  await renderWithProviders(<DrinkHouseMade {...props({ initial: startPrep('syrup', 'Pine syrup'), save: { onSave, saving: true, canSave: true } })} />);
  await laidOut();
  expect(screen.getByText('Saving…')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
});

test('empty, with a name that says nothing: all four rows say Add (Add-inside, Empty)', async () => {
  await renderWithProviders(<DrinkHouseMade {...props({ name: 'Rvwa' })} />);
  await laidOut();
  for (const row of ['What it is', 'Method', 'Makes', 'Keeps']) expect(screen.getByText(row)).toBeTruthy();
  expect(screen.getAllByText('Add')).toHaveLength(4);
});
