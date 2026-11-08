import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddDrinkWizard } from './AddDrinkWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();
let mockBarGlasses: unknown[] = [];
let mockVenueIce: unknown[] = [];
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('./NearNameCard', () => ({ NearNameCard: () => null }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }), useUserId: () => 'me' }));
let mockClosest: { id: string; name: string } | null = null;
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: mockClosest }), useCloseClassics: () => ({ data: mockClosest ? [{ ...mockClosest, shares: ['gin', 'Campari'] }] : [] }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: [] }), useShelfEdit: () => ({ add: { mutate: jest.fn() }, remove: { mutate: jest.fn() } }) }));
jest.mock('@/hooks/usePublishing', () => ({ useBarPublishing: () => ({ data: undefined }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [], isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'bar-1', name: 'Little Rye' }], active: null }) }));
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
jest.mock('@/hooks/useRankings', () => ({ usePublicBars: (q: string) => ({ data: q.length >= 2 ? [{ id: 'bar-p-attaboy', display_name: 'Attaboy', city: 'New York' }] : [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [{ id: 'c-negroni', name: 'Negroni', imageUrl: null }] }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
// "Is this one of your glasses?" (components/screens/venue/GlasswarePrompt.test.tsx) asks no one here: nobody has brand.
jest.mock('@/hooks/useBarGlassware', () => ({ useBarGlassware: () => ({ data: mockBarGlasses }), useBarPageId: () => ({ data: 'page-1' }), useSaveBarGlass: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useVenueIce', () => ({ useVenueIce: () => ({ data: mockVenueIce }) }));
jest.mock('@/hooks/useBackBar', () => ({
  useBackBarIds: () => new Set(),
  useBackBarParts: () => ({ fixed: new Map(), stocked: new Map(), ids: new Set() }),
  useStockMutations: () => ({ add: { mutate: jest.fn() }, remove: { mutate: jest.fn() } }),
}));
jest.mock('@/hooks/useCreateDrink', () => ({ useCreateDrink: () => ({ mutate: mockCreate, isPending: false }) }));
const mockStart = jest.fn();
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: mockStart, isPending: false }), useClassicPreview: () => ({ data: null }) }));
jest.mock('@/hooks/useSameNameDrink', () => ({ useSameNameDrink: () => ({ data: null }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/useDrinkDesk', () => ({ ...jest.requireActual('@/hooks/useDrinkDesk'), useMenuSectionPlace: () => ({ data: undefined }) }));
// A venue's suppliers and costs (m01) read their own hooks; these tests are about the draft page.
jest.mock('./useDeskLines', () => ({ ...jest.requireActual('./useDeskLines'), useVenueLines: () => ({ lines: {}, cost: null }) }));
beforeEach(() => {
  mockCreate.mockReset();
  mockStart.mockReset();
  mockSaved.mockReset();
  mockBarGlasses = [];
  mockVenueIce = [];
  mockClosest = null;
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ units: 'ml' });
});
// iOS draws the screen after its first layout (the keyboard offset needs it).
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
// A row on the draft page opens its sheet ("Glass: pick one").
// A spec line on the draft page reads as drawn; a tap opens its editor (DraftLine).
const line = (text: string) => fireEvent.press(screen.getByRole('button', { name: `${text}. Edit` }));
const row = (name: string) => fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}: `) }));
describe('AddDrinkWizard', () => {
  test('a name, then ingredients by search, stepper, typing and a quick add', async () => {
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'house negroni');
    expect(useDrinkWizardStore.getState().kept.home.draft.name).toBe('House Negroni');

    // An empty spec offers classics to start from, not quick adds.
    expect(screen.queryByRole('group', { name: 'Quick adds' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'gin');
    await fireEvent.press(screen.getByRole('button', { name: 'Gin' }));
    await line('60 ml Gin');
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('60');
    await fireEvent.press(screen.getByRole('button', { name: 'More Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Less Gin' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Less Gin' }));
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('50');
    await fireEvent.changeText(screen.getByLabelText('Amount of Gin'), '1 1/2');
    await fireEvent(screen.getByLabelText('Amount of Gin'), 'blur');
    expect(screen.getByLabelText('Amount of Gin').props.value).toBe('1.5');
    await fireEvent.changeText(screen.getByLabelText('Amount of Gin'), '30');

    // With a line in, the quick adds show, and one starts at a likely pour.
    await fireEvent.press(screen.getByRole('button', { name: 'Add Campari' }));
    expect(screen.getByRole('button', { name: '30 ml Campari. Edit' })).toBeTruthy();
    expect(useDrinkWizardStore.getState().kept.home.draft.lines.map((l) => [l.name, l.amount, l.unit])).toEqual([['Gin', '30', 'ml'], ['Campari', '30', 'ml']]);
  });

  test('ingredients: the unit switch (ml or oz sticks), remove and undo, kept on the device as they change', async () => {
    useDrinkWizardStore.getState().patch('home', {
      name: 'House Negroni',
      lines: [
        { key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' },
        { key: 'k2', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' },
      ],
    });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();

    // A line opens to its editor; the unit is a tap away from changing.
    await line('30 ml Gin');
    await line('30 ml Campari');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Unit: ml' })[1]);
    await fireEvent.press(screen.getByRole('radio', { name: 'oz' }));
    expect(screen.getAllByRole('button', { name: 'Unit: oz' })).toHaveLength(1);
    expect(screen.getByLabelText('Amount of Campari').props.value).toBe('1');

    // Remove, then undo, puts it back where it was.
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Gin' }));
    expect(screen.queryByLabelText('Amount of Gin')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo removing Gin' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.lines.map((l) => l.name)).toEqual(['Gin', 'Campari']);
    // No amount reads as the board's amber gap once the line is put away.
    await fireEvent.changeText(screen.getByLabelText('Amount of Campari'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Done with Campari' }));
    expect(screen.getByText('Add amount')).toBeTruthy();
    await line('Campari, no amount yet');
    await fireEvent.changeText(screen.getByLabelText('Amount of Campari'), '');

    // The kept draft is on the device already, before any save.
    const kept = useDrinkWizardStore.getState().kept.home;
    expect(kept.draft.name).toBe('House Negroni');
    expect(kept.draft.lines.map((l) => [l.id, l.amount, l.unit])).toEqual([['gin', '30', 'ml'], ['campari', '', 'oz']]);

    // oz is yours now: the next line starts in it; a dash is for its line only (Mat, 4 Nov).
    expect(useSettingsStore.getState().units).toBe('oz');
    await fireEvent.press(screen.getByRole('button', { name: 'Unit: oz' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'dash' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done with Campari' }));
    await fireEvent.changeText(screen.getByLabelText('Add another ingredient'), 'gin');
    await fireEvent.press(screen.getByRole('button', { name: 'Gin' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.lines.map((l) => [l.name, l.unit])).toEqual([['Gin', 'ml'], ['Campari', 'dash'], ['Gin', 'oz']]);
  });

  test('the method in its sheet, then Save saves once', async () => {
    useDrinkWizardStore.getState().patch('home', {
      name: 'House Negroni',
      lines: [
        { key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' },
        { key: 'k2', id: 'campari', name: 'Campari', amount: '', unit: 'oz' },
      ],
    });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByRole('button', { name: 'Back to where you were. Your draft is kept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Glass: pick one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ice: not added' })).toBeTruthy();

    // Method: several, in order, and your own.
    await row('Method');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stir, suggested' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    await fireEvent.changeText(screen.getByLabelText('Your own method'), 'Smoke rinse');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('checkbox', { name: 'Smoke rinse', checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Method: Stir, then Smoke rinse' })).toBeTruthy();

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

  test('a kept draft opens as it was left, and Start over clears it', async () => {
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Paloma' });
    await renderWithProviders(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('Paloma');
    expect(screen.getByText('Picked up where you left off.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByLabelText('Name').props.value).toBe('');
    expect(screen.queryByText('Picked up where you left off.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save drink', disabled: true })).toBeTruthy();
  });

  test('the glass sheet offers the bar\'s own glasses, else every shape, and a new glass drops the pick', async () => {
    mockBarGlasses = [
      { id: 'bg', glass: 'rocks', variant: 'rocks_tapered', name: 'Butcher Glass', is_default: true, bar_name: 'Little Rye' },
      { id: 'bg2', glass: 'rocks', variant: 'rocks_heavy', name: 'Heavy rocks', is_default: false, bar_name: 'Little Rye' },
    ];
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Negroni' });
    await renderWithProviders(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await row('Glass');
    expect(screen.queryByText('WHICH SHAPE?')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(screen.getByText('WHICH SHAPE?')).toBeTruthy();
    // The bar's two rocks glasses, by their names, its main one picked; not every rocks shape.
    expect(screen.getByRole('radio', { name: 'Butcher Glass', checked: true })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Straight' })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Heavy rocks' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.glassVariant).toBe('rocks_heavy');

    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.glassVariant).toBeNull();
    // A glass the bar has none of offers every shape.
    await fireEvent.press(screen.getByRole('radio', { name: 'Coupe' }));
    expect(screen.getByRole('radio', { name: 'Wide', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Saucer' })).toBeTruthy();
    // Only someone who may change the glassware is asked to add a glass.
    await fireEvent.press(screen.getByRole('radio', { name: 'Coupe' }));
    expect(screen.queryByText('Is this one of your glasses?')).toBeNull();
  });

  test('the ice sheet offers the venue\'s own ice first', async () => {
    mockVenueIce = [{ name: 'Shaved', shape: 'shaved', draw_as: null }, { name: 'Block', shape: 'block', draw_as: null }, { name: 'Large cube', shape: 'large', draw_as: null }];
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Julep' });
    await renderWithProviders(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await row('Ice');
    expect(screen.getByText('LITTLE RYE’S ICE')).toBeTruthy();
    // Shaved isn't one of the common ones, but it's the venue's, so it's offered.
    await fireEvent.press(screen.getByRole('radio', { name: 'Shaved' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.ice?.name).toBe('Shaved');
  });

  test('tapping a name, then Swap, swaps the ingredient and keeps its amount', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'Martinez', lines: [{ key: 'k1', id: 'gin', name: 'Gin', amount: '45', unit: 'ml' }] });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await line('45 ml Gin');
    await fireEvent.press(screen.getByRole('button', { name: 'Gin, 45 ml' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Swap Gin for another ingredient' }));
    await fireEvent.changeText(screen.getByLabelText('Rename Gin or pick another'), 'verm');
    await fireEvent.press(screen.getByRole('button', { name: 'Sweet Vermouth' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.lines).toEqual([{ key: 'k1', id: 'vermouth', name: 'Sweet Vermouth', amount: '45', unit: 'ml' }]);
  });

  test('a spec close to a classic offers it as a riff, and Credit picks it up', async () => {
    mockClosest = { id: 'c-negroni', name: 'Negroni' };
    useDrinkWizardStore.getState().patch('bar-1', {
      name: 'Rye Bitter',
      lines: [
        { key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' },
        { key: 'k2', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' },
      ],
    });
    await renderWithProviders(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByText('Close to a Negroni. Make it a riff?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Riff on the Negroni' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.riffOf).toEqual({ id: 'c-negroni', name: 'Negroni' });
    expect(screen.getByText('Close to a Negroni. It’s down as a riff on it.')).toBeTruthy();

    await row('Credit');
    expect(await screen.findByRole('radio', { name: 'Negroni, shares gin, campari', checked: true })).toBeTruthy();
    expect(screen.getByText('It’s credited to Little Rye too.')).toBeTruthy();
    expect(screen.getByText('First made at Little Rye.')).toBeTruthy();
  });

  test('a name that is a classic offers its spec, and the method sheet offers the guess from it', async () => {
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Negroni');
    expect(screen.getByText('Negroni is a classic. Start from its spec?')).toBeTruthy();
    // The card for the name leads; the empty spec's classic chips come after it.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Start from the Negroni' })[0]);
    expect(mockStart.mock.calls[0][0]).toBe('c-negroni');
    await act(() =>
      mockStart.mock.calls[0][1].onSuccess({
        lines: [{ key: 'a', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' }, { key: 'b', id: 'campari', name: 'Campari', amount: '30', unit: 'ml' }, { key: 'c', id: 'vermouth', name: 'Sweet Vermouth', amount: '30', unit: 'ml' }],
        riffOf: { id: 'c-negroni', name: 'Negroni' },
      })
    );
    expect(screen.getByRole('button', { name: '30 ml Sweet Vermouth. Edit' })).toBeTruthy();
    expect(screen.queryByText('Negroni is a classic. Start from its spec?')).toBeNull();

    // All spirit: stirred, offered first.
    await row('Method');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stir, suggested' }));
    expect(useDrinkWizardStore.getState().kept.home.draft.methods).toEqual([{ id: 'm-stir', name: 'Stir' }]);
  });
});
