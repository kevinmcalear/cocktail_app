import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { AddBottle } from './AddBottle';

const mockSave = jest.fn();
let mockConnected = true;

jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockConnected }) }));

// The band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useDropdowns', () => ({
  useDropdowns: () => ({
    data: {
      ingredients: [
        { id: 'campari', name: 'Campari', ingredient_role: 'product' },
        { id: 'gin', name: 'Gin', ingredient_role: 'generic' },
        { id: 'islay', name: 'Islay Scotch', ingredient_role: 'generic' },
        { id: 'l10', name: 'Laphroaig 10', ingredient_role: 'product', brand_maker: 'Laphroaig', generic_id: 'islay' },
      ],
      ingredientAliases: [],
      coreIngredientIds: ['gin', 'islay'],
    },
  }),
}));
jest.mock('@/hooks/useSaveBottle', () => ({
  useSaveBottle: () => ({ mutate: mockSave, isPending: false }),
  useBottleStrengths: () => ({ l10: 40 }),
  // Campari is already on the back bar.
  useBottleHere: () => (id: string | null | undefined) => (id === 'campari' ? { since: '2026-03-02T12:00:00Z', drinks: 6 } : null),
}));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/components/ds/IngredientDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { IngredientDrawing: () => <View testID="drawing" /> };
});

const laidOut = () => fireEvent(screen.getByTestId('add-bottle'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const saveButton = () => screen.getByRole('button', { name: 'Save the bottle' });

describe('AddBottle', () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockConnected = true;
  });

  test('empty: one Snap the label, the quiet way to something you make, and Save waits for a name', async () => {
    const onMake = jest.fn();
    await renderWithProviders(<AddBottle onClose={jest.fn()} onSaved={jest.fn()} onMake={onMake} />);
    await laidOut();
    expect(screen.getAllByRole('button', { name: 'Snap the label' })).toHaveLength(1);
    expect(screen.getByText('Name it to save. The rest can wait for its page.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save the bottle', disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'It’s something I make: the house-made steps' }));
    expect(onMake).toHaveBeenCalledWith('');
  });

  test('a new bottle: its maker, strength and kind on the same screen, saved as one', async () => {
    await renderWithProviders(<AddBottle barId="bar-1" onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'tanqueray No. Ten gin');
    await fireEvent.changeText(screen.getByLabelText('Who makes it'), 'Tanqueray');
    await fireEvent.changeText(screen.getByLabelText('How strong, % ABV'), '47.3');
    // The kind its name says, shown so it can be changed.
    expect(screen.getByText('Drinks that call for gin can use it. Picked from the name; change it here.')).toBeTruthy();
    await fireEvent.press(saveButton());
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ barId: 'bar-1', existing: false, name: 'Tanqueray No. Ten Gin', maker: 'Tanqueray', abv: 47.3, genericId: 'gin', queued: false }),
      expect.anything()
    );
  });

  test('Is it this one? A catalog pick fills in the maker, strength and kind, and goes on the back bar', async () => {
    await renderWithProviders(<AddBottle barId="bar-1" onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Laphroaig 1');
    expect(screen.getByText('Is it this one?'.toUpperCase())).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, this one: Laphroaig 10, Laphroaig · 40% · Islay Scotch' }));
    expect(screen.getByLabelText('How strong, % ABV: 40')).toBeTruthy();
    expect(screen.getByLabelText('A kind of: Islay Scotch')).toBeTruthy();
    await fireEvent.press(saveButton());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'l10', barId: 'bar-1', existing: true }), expect.anything());
  });

  test('No, it is a new one: the fields to fill in yourself', async () => {
    await renderWithProviders(<AddBottle onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Laphroaig 1');
    expect(screen.queryByLabelText('Who makes it')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'No, “Laphroaig 1” is a new one' }));
    expect(screen.getByLabelText('Who makes it')).toBeTruthy();
  });

  test('name taken: Use Campari or a different bottle, and Save waits', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(<AddBottle barId="bar-1" onClose={jest.fn()} onSaved={onSaved} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'campari');
    expect(screen.getByText('On the back bar since March, in 6 drinks. Use that one, or give this bottle a name that tells them apart.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save the bottle', disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use Campari' }));
    expect(onSaved).toHaveBeenCalledWith({ id: 'campari', name: 'Campari' }, true);
  });

  test('a kind (or a house-made) by that name is not a bottle to stock', async () => {
    await renderWithProviders(<AddBottle barId="bar-1" onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'gin');
    expect(screen.getByText('Gin is already here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Gin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save the bottle', disabled: true })).toBeTruthy();
  });

  test('offline: Save on this phone keeps it to send later', async () => {
    mockConnected = false;
    const onClose = jest.fn();
    await renderWithProviders(<AddBottle onClose={onClose} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Buffalo Trace');
    expect(screen.getByText('You’re offline. It’s kept on this phone and saves when you’re back.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save on this phone' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Buffalo Trace', barId: null, queued: true }), expect.anything());
    expect(onClose).toHaveBeenCalled();
  });
});
