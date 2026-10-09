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
const mockStart = jest.fn();
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: mockStart, isPending: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));

beforeEach(() => {
  mockCreate.mockReset();
  mockStart.mockReset();
  mockSaved.mockReset();
  mockBarGlasses = [];
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ defaultUnit: 'ml' });
});

// iOS draws the screen after its first layout (the keyboard offset needs it).
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = () => fireEvent.press(screen.getByRole('button', { name: /^Next: / }));

describe('AddDrinkWizard', () => {
  // One walk through the wizard, in three parts so none runs near Jest's 5 s limit on a busy CI runner.
  test('a name, then ingredients by quick add, stepper, typing and search', async () => {
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByText('What’s it called?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'house negroni');
    await next();

    // Ingredients: a quick add starts at a likely pour; the stepper walks it, and it can be typed.
    await fireEvent.press(screen.getByRole('button', { name: 'Add Gin' }));
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('60');
    await fireEvent.press(screen.getByRole('button', { name: 'More Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Less Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Less Gin' }));
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('50');
    await fireEvent.changeText(screen.getByLabelText('Amount of Gin'), '1 1/2');
    await fireEvent(screen.getByLabelText('Amount of Gin'), 'blur');
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('1.5');
    await fireEvent.changeText(screen.getByLabelText('Amount of Gin'), '30');
    await fireEvent.changeText(screen.getByLabelText('Add another ingredient'), 'camp');
    await fireEvent.press(screen.getByRole('button', { name: 'Campari' }));
    expect(screen.getByLabelText('Amount of Campari').props.value).toBe('30');
    expect(useDrinkWizardStore.getState().kept.home.draft.lines.map((l) => [l.name, l.amount, l.unit])).toEqual([['Gin', '30', 'ml'], ['Campari', '30', 'ml']]);
  });

  test('ingredients: the unit switch, remove and undo, and Back keep what was added', async () => {
    useDrinkWizardStore.getState().patch('home', {
      name: 'House Negroni',
      lines: [
        { key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' },
        { key: 'k2', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' },
      ],
    });
    useDrinkWizardStore.getState().setStep('home', 'ingredients');
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();

    // The unit is in sight, and a tap away from changing.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Unit: ml' })[1]);
    await fireEvent.press(screen.getByRole('radio', { name: 'oz' }));
    expect(screen.getAllByRole('button', { name: 'Unit: oz' })).toHaveLength(1);
    expect(screen.getByLabelText('Amount of Campari').props.value).toBe('1');

    // Remove, then undo, puts it back where it was.
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Gin' }));
    expect(screen.queryByLabelText('Amount of Gin')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo removing Gin' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.lines.map((l) => l.name)).toEqual(['Gin', 'Campari']);

    // Back to the name and forward again: nothing is lost.
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Name').props.value).toBe('House Negroni');
    await next();
    expect(screen.getByLabelText('Amount of Campari').props.value).toBe('1');
    await fireEvent.changeText(screen.getByLabelText('Amount of Campari'), '');
    await next();

    // The kept draft is on the device already, before any save.
    const kept = useDrinkWizardStore.getState().kept.home;
    expect(kept.step).toBe('method');
    expect(kept.draft.name).toBe('House Negroni');
    expect(kept.draft.lines.map((l) => [l.id, l.amount, l.unit])).toEqual([['gin', '30', 'ml'], ['campari', '', 'oz']]);
  });

  test('method, skipped steps, then the review saves once', async () => {
    useDrinkWizardStore.getState().patch('home', {
      name: 'House Negroni',
      lines: [
        { key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' },
        { key: 'k2', id: 'campari', name: 'Campari', amount: '', unit: 'oz' },
      ],
    });
    useDrinkWizardStore.getState().setStep('home', 'method');
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();

    // Method: several, in order, and your own.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stir, suggested' }));
    await fireEvent.changeText(screen.getByLabelText('Your own method'), 'Smoke rinse');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Stir, then Smoke rinse')).toBeTruthy();
    await next();

    // Optional steps can be skipped.
    expect(screen.getByRole('button', { name: 'Next: ice' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('What ice?')).toBeTruthy();

    expect(useDrinkWizardStore.getState().kept.home.step).toBe('ice');

    // On to the review and save.
    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('30 ml Gin\nCampari')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const input = mockCreate.mock.calls[0][0];
    expect(input.barId).toBeNull();
    expect(input.myProfileId).toBe('p-me');
    expect(input.draft.lines.map((l: { id: string; amount: string; unit: string }) => [l.id, l.amount, l.unit])).toEqual([['gin', '30', 'ml'], ['campari', '', 'oz']]);
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

  test('tapping a name swaps the ingredient and keeps its amount', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'Martinez', lines: [{ key: 'k1', id: 'gin', name: 'Gin', amount: '45', unit: 'ml' }] });
    useDrinkWizardStore.getState().setStep('home', 'ingredients');
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.press(screen.getByRole('button', { name: 'Gin, 45 ml' }));
    await fireEvent.changeText(screen.getByLabelText('Swap Gin for…'), 'verm');
    await fireEvent.press(screen.getByRole('button', { name: 'Sweet Vermouth' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.lines).toEqual([{ key: 'k1', id: 'vermouth', name: 'Sweet Vermouth', amount: '45', unit: 'ml' }]);
  });

  test('a name that is a classic offers its spec, and the method step offers the guess from it', async () => {
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Negroni');
    await fireEvent.press(screen.getByRole('button', { name: 'Start from the Negroni' }));
    expect(mockStart.mock.calls[0][0]).toBe('c-negroni');
    await act(() =>
      mockStart.mock.calls[0][1].onSuccess({
        lines: [{ key: 'a', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' }, { key: 'b', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' }, { key: 'c', id: 'vermouth', name: 'Sweet Vermouth', amount: '30', unit: 'ml' }],
        riffOf: { id: 'c-negroni', name: 'Negroni' },
      })
    );
    expect(screen.getByText('What goes in?')).toBeTruthy();
    expect(screen.getByLabelText('Amount of Sweet Vermouth').props.value).toBe('30');

    // All spirit: stirred, offered first, and all three in one tap.
    await next();
    expect(screen.getByRole('checkbox', { name: 'Stir, suggested' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Use Stir, / }));
    const d = useDrinkWizardStore.getState().kept.home;
    expect(d.step).toBe('garnish');
    expect(d.draft.methods).toEqual([{ id: 'm-stir', name: 'Stir' }]);
    expect(d.draft.glass?.name).toBeTruthy();
    expect(d.draft.ice?.name).toBeTruthy();
  });
});
