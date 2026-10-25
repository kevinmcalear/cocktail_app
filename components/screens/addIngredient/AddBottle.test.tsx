import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { AddBottle } from './AddBottle';

const mockCreate = jest.fn();

// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('@/hooks/useDropdowns', () => ({
  useDropdowns: () => ({
    data: {
      ingredients: [
        { id: 'simple', name: 'Simple Syrup' },
        { id: 'gin', name: 'Gin' },
      ],
      ingredientAliases: [{ key: '1:1 sugar syrup', item_id: 'simple' }],
      coreIngredientIds: ['simple', 'gin'],
    },
  }),
}));
jest.mock('@/hooks/useCreateIngredient', () => ({ useCreateIngredient: () => ({ mutate: mockCreate, isPending: false }) }));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/components/ds/IngredientDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { IngredientDrawing: () => <View testID="drawing" /> };
});

const laidOut = () => fireEvent(screen.getByTestId('add-bottle'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

describe('AddBottle', () => {
  beforeEach(() => mockCreate.mockReset());

  test('a bottle you buy: its name, maker and strength on one screen, saved as a bottle', async () => {
    await renderWithTamagui(<AddBottle barId="bar-1" onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Tanqueray No. Ten');
    await fireEvent.changeText(screen.getByLabelText('Who makes it'), 'Tanqueray');
    await fireEvent.changeText(screen.getByLabelText('How strong (ABV %)'), '47.3');
    await fireEvent.press(screen.getByRole('button', { name: 'Save the bottle' }));
    expect(mockCreate).toHaveBeenCalledWith({ draft: expect.objectContaining({ name: 'Tanqueray No. Ten', role: 'product', maker: 'Tanqueray', abv: '47.3' }), barId: 'bar-1' }, expect.anything());
  });

  test('a name that is already here offers that one; something you make goes to the recipe steps', async () => {
    const onSaved = jest.fn();
    const onMake = jest.fn();
    await renderWithTamagui(<AddBottle onClose={jest.fn()} onSaved={onSaved} onMake={onMake} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), '1:1 sugar syrup');
    expect(screen.getByRole('button', { name: 'Save the bottle', disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use Simple Syrup' }));
    expect(onSaved).toHaveBeenCalledWith({ id: 'simple', name: 'Simple Syrup' }, true);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'House grenadine');
    await fireEvent.press(screen.getByRole('link', { name: 'It’s something you make: the house recipe steps' }));
    expect(onMake).toHaveBeenCalledWith('House Grenadine');
  });

  test('something else (a plain ingredient from a spec editor) is just its name', async () => {
    await renderWithTamagui(<AddBottle initialName="Fresh lime juice" onClose={jest.fn()} onSaved={jest.fn()} onMake={jest.fn()} />);
    await laidOut();
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    expect(screen.queryByLabelText('Who makes it')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save it' }));
    expect(mockCreate).toHaveBeenCalledWith({ draft: expect.objectContaining({ name: 'Fresh lime juice', role: 'other' }), barId: null }, expect.anything());
  });
});
