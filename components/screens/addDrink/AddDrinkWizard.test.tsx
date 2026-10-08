import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddDrinkWizard } from './AddDrinkWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();
let mockBarGlasses: unknown[] = [];

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }) }));
jest.mock('@/hooks/useDropdowns', () => ({
  useDropdowns: () => ({
    data: {
      ingredients: [{ id: 'gin', name: 'Gin' }, { id: 'campari', name: 'Campari' }, { id: 'vermouth', name: 'Sweet Vermouth' }],
      methods: [{ id: 'm-stir', name: 'Stir' }],
      glassware: [{ id: 'g-rocks', name: 'Rocks' }],
      iceTypes: [],
    },
  }),
}));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-me', displayName: 'Jo', isPublic: false, isModerated: false } }) }));
jest.mock('@/hooks/useProfiles', () => ({ usePublicPeople: () => ({ data: [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [{ id: 'c-negroni', name: 'Negroni', imageUrl: null }] }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ useBarGlassware: () => ({ data: mockBarGlasses }) }));
jest.mock('@/hooks/useCreateDrink', () => ({ useCreateDrink: () => ({ mutate: mockCreate, isPending: false }) }));

beforeEach(() => {
  mockCreate.mockReset();
  mockSaved.mockReset();
  mockBarGlasses = [];
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ defaultUnit: 'ml' });
});

// iOS draws the screen after its first layout (the keyboard offset needs it).
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = () => fireEvent.press(screen.getByRole('button', { name: /^Next: / }));

describe('AddDrinkWizard', () => {
  test('a name, then each step keeps what was added through Back, and saves once at the end', async () => {
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByText('What’s it called?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'house negroni');
    await next();

    // Ingredients: a quick add, one by search, and the stepper.
    await fireEvent.press(screen.getByRole('button', { name: 'Add Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Less Gin' }));
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'camp');
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(screen.getByRole('button', { name: 'Amount: 30 ml' })).toBeTruthy();

    // Back to the name and forward again: nothing is lost.
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Name').props.value).toBe('House Negroni');
    await next();
    expect(screen.getByRole('button', { name: 'Amount: – ml' })).toBeTruthy();
    await next();

    // Method: several, in order, and your own.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stir' }));
    await fireEvent.changeText(screen.getByLabelText('Your own method'), 'Smoke rinse');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Stir, then Smoke rinse')).toBeTruthy();
    await next();

    // Optional steps can be skipped.
    expect(screen.getByRole('button', { name: 'Next: ice' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('What ice?')).toBeTruthy();

    // The kept draft is on the device already, before any save.
    const kept = useDrinkWizardStore.getState().kept.home;
    expect(kept.draft.name).toBe('House Negroni');
    expect(kept.step).toBe('ice');

    // On to the review and save.
    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('30 ml Gin\nCampari')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const input = mockCreate.mock.calls[0][0];
    expect(input.barId).toBeNull();
    expect(input.myProfileId).toBe('p-me');
    expect(input.draft.lines.map((l: { id: string; amount: string }) => [l.id, l.amount])).toEqual([['gin', '30'], ['campari', '']]);
    expect(input.draft.methods).toEqual([{ id: 'm-stir', name: 'Stir' }, { id: null, name: 'Smoke rinse' }]);

    // Saved: the kept draft goes and the caller hears the new id.
    await act(() => mockCreate.mock.calls[0][1].onSuccess({ id: 'new-drink', warnings: [] }));
    expect(mockSaved).toHaveBeenCalledWith('new-drink');
    expect(useDrinkWizardStore.getState().kept.home).toBeUndefined();
  });

  test('a kept draft opens where it was left, and Start over clears it', async () => {
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Paloma' });
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('Paloma');
    await fireEvent.press(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByLabelText('Name').props.value).toBe('');
    expect(screen.getByRole('button', { name: 'Next: ingredients', disabled: true })).toBeTruthy();
  });

  test('the glass step offers its shapes, marks the bar\'s, and a new glass drops the pick', async () => {
    mockBarGlasses = [{ id: 'bg', glass: 'rocks', variant: 'rocks_tapered', is_default: true, bar_name: 'Little Rye' }];
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Negroni' });
    useDrinkWizardStore.getState().setStep('bar-1', 'glass');
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.queryByText('WHICH SHAPE?')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(screen.getByText('WHICH SHAPE?')).toBeTruthy();
    expect(screen.getByText('Little Rye uses this')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Tapered', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Heavy base' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.glassVariant).toBe('rocks_heavy');
    expect(screen.getByRole('radio', { name: 'Heavy base', checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.glassVariant).toBeNull();
  });
});
