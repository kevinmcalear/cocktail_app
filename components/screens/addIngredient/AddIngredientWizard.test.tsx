import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useIngredientWizardStore } from '@/store/useIngredientWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddIngredientWizard } from './AddIngredientWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();

jest.mock('@/hooks/useDropdowns', () => ({
  useDropdowns: () => ({
    data: {
      ingredients: [
        { id: 'simple', name: 'Simple Syrup' },
        { id: 'grenadine', name: 'Grenadine' },
        { id: 'syrup', name: 'Syrup' },
        { id: 'gin', name: 'Gin' },
        { id: 'sugar', name: 'Sugar' },
      ],
      ingredientAliases: [{ key: '1:1 sugar syrup', item_id: 'simple' }],
      coreIngredientIds: ['simple', 'grenadine', 'syrup', 'gin', 'sugar'],
    },
  }),
}));
jest.mock('@/hooks/useCreateIngredient', () => ({ useCreateIngredient: () => ({ mutate: mockCreate, isPending: false }) }));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/components/ds/IngredientDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
  return { IngredientDrawing: () => <View testID="drawing" /> };
});

beforeEach(() => {
  mockCreate.mockReset();
  mockSaved.mockReset();
  useIngredientWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ defaultUnit: 'ml' });
});

const laidOut = () => fireEvent(screen.getByTestId('add-ingredient'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = () => fireEvent.press(screen.getByRole('button', { name: /^Next: / }));

describe('AddIngredientWizard', () => {
  test('a name that is already here, by an alias, offers that one instead of a copy', async () => {
    await renderWithTamagui(<AddIngredientWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), '1:1 sugar syrup');
    expect(screen.getByText('Simple Syrup is already here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: what it is', disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use Simple Syrup' }));
    expect(mockSaved).toHaveBeenCalledWith({ id: 'simple', name: 'Simple Syrup' }, true);
  });

  test('a house prep: guessed as made in house, its kind from the name, then a recipe', async () => {
    await renderWithTamagui(<AddIngredientWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'house grenadine syrup');
    await next();

    // Next takes the marked guess; a bottle's maker step isn't there for a prep: the kind, then the recipe.
    expect(screen.getByRole('radio', { name: 'Made in house, suggested' })).toBeTruthy();
    await next();
    expect(useIngredientWizardStore.getState().kept['bar-1'].draft.role).toBe('prep');
    await fireEvent.press(screen.getByRole('radio', { name: 'Grenadine, suggested' }));
    await next();
    expect(screen.getByText('What goes in it?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'sugar');
    await fireEvent.press(screen.getByRole('button', { name: 'Sugar' }));
    await fireEvent.changeText(screen.getByLabelText('Add another ingredient'), 'Pomegranate juice');
    await fireEvent(screen.getByLabelText('Add another ingredient'), 'submitEditing');
    // No cocktail pours in a recipe.
    expect(screen.getByLabelText('Amount of Sugar').props.value).toBe('');
    await fireEvent.changeText(screen.getByLabelText('Amount of Sugar'), '500');
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(screen.getByText('Look right?')).toBeTruthy();
    expect(screen.getByText('500 ml Sugar\nPomegranate juice')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save ingredient' }));
    const input = mockCreate.mock.calls[0][0];
    expect(input.barId).toBe('bar-1');
    expect(input.draft).toMatchObject({ name: 'House Grenadine Syrup', role: 'prep', generic: { id: 'grenadine', name: 'Grenadine' } });
    expect(input.draft.lines.map((l: { id: string | null; name: string }) => [l.id, l.name])).toEqual([['sugar', 'Sugar'], [null, 'Pomegranate juice']]);

    await act(() => mockCreate.mock.calls[0][1].onSuccess({ id: 'new-ing' }));
    expect(mockSaved).toHaveBeenCalledWith({ id: 'new-ing', name: 'House Grenadine Syrup' }, false);
    expect(useIngredientWizardStore.getState().kept['bar-1']).toBeUndefined();
  });

  test('a bottle asks for its maker and offers its kind’s strength', async () => {
    useIngredientWizardStore.getState().patch('home', { name: 'Navy Strength Gin', role: 'product', generic: { id: 'gin', name: 'Gin' } });
    useIngredientWizardStore.getState().setStep('home', 'maker');
    await renderWithTamagui(<AddIngredientWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Maker'), 'Plymouth');
    await next();
    await fireEvent.press(screen.getByRole('button', { name: /%, suggested$/ }));
    expect(useIngredientWizardStore.getState().kept.home.draft.abv).toMatch(/^\d/);
  });
});
