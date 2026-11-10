import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddDrinkWizard } from './AddDrinkWizard';

const mockSaved = jest.fn();
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('./NearNameCard', () => ({ NearNameCard: () => null }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }), useUserId: () => 'me' }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }), useCloseClassics: () => ({ data: [] }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: [] }), useShelfEdit: () => ({ add: { mutate: jest.fn() }, remove: { mutate: jest.fn() } }) }));
jest.mock('@/hooks/usePublishing', () => ({ useBarPublishing: () => ({ data: undefined }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [], isPending: false }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [], active: null }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: { ingredients: [{ id: 'gin', name: 'Gin' }], methods: [], glassware: [], iceTypes: [] } }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-me', displayName: 'Jo', isPublic: false, isModerated: false } }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/usePairings', () => ({ usePairings: () => ({ data: [] }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ useBarGlassware: () => ({ data: [] }) }));
jest.mock('@/hooks/useVenueIce', () => ({ useVenueIce: () => ({ data: [] }) }));
jest.mock('@/hooks/useBackBar', () => ({
  useBackBarIds: () => new Set(),
  useBackBarParts: () => ({ fixed: new Map(), stocked: new Map(), ids: new Set() }),
  useStockMutations: () => ({ add: { mutate: jest.fn() }, remove: { mutate: jest.fn() } }),
}));
jest.mock('@/hooks/useCreateDrink', () => ({ useCreateDrink: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: jest.fn(), isPending: false }), useClassicPreview: () => ({ data: null }) }));
jest.mock('@/hooks/useSameNameDrink', () => ({ useSameNameDrink: () => ({ data: null }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/useDrinkDesk', () => ({ ...jest.requireActual('@/hooks/useDrinkDesk'), useMenuSectionPlace: () => ({ data: undefined }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: true }) }));
jest.mock('@/hooks/useSameNamePrep', () => ({ ...jest.requireActual('@/hooks/useSameNamePrep'), useSameNamePrep: () => ({ data: null, checking: false }) }));
// A venue's suppliers and costs (m01) read their own hooks; these tests are about the page.
jest.mock('./useDeskLines', () => ({ ...jest.requireActual('./useDeskLines'), useVenueLines: () => ({ lines: {}, cost: null }) }));

beforeEach(() => {
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ units: 'ml' });
});
// iOS draws the screen after its first layout (the keyboard offset needs it).
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const line = (text: string) => fireEvent.press(screen.getByRole('button', { name: `${text}. Edit` }));

describe('the draft page', () => {
  test('a bottle switched on a line says so under the lines, with Undo', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'House Negroni', lines: [{ key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' }] });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await line('30 ml Gin');
    // The hint sits under the open line, the only place its bottle shows.
    expect(screen.getByText('The bottle on the right: lit when it’s on your shelf. Tap to change.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gin is not on your shelf. Add it' }));
    expect(screen.getByText('Gin is on your shelf')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Gin is on your shelf' }));
    expect(screen.queryByText('Gin is on your shelf')).toBeNull();
  });

  test('Make it here, then Back: Leave it for now? and the line is a recipe to finish, Drafts the way back', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'Pine Fizz', lines: [{ key: 'k1', id: null, name: 'Pine syrup', amount: '20', unit: 'ml', later: true }] });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    // The main button alone (Kevin, 8 Nov: "Later on close").
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Make Pine syrup here' }));
    await fireEvent(screen.getByTestId('part-page'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    expect(screen.getByText('HOUSE-MADE · DRAFT, INSIDE THE DRINK')).toBeTruthy();
    await fireEvent.changeText(screen.getAllByLabelText('Add an ingredient').at(-1)!, 'Spruce tips');
    await fireEvent.press(screen.getByRole('button', { name: /^Add “Spruce tips”$/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Fizz/ }));
    expect(screen.getByText('What you’ve done is kept. Pine Fizz shows it as Recipe to finish, and Drafts lists the drink with the way back.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave it for now' }));
    expect(screen.queryByTestId('part-page')).toBeNull();
    const kept = useDrinkWizardStore.getState().kept.home.draft.lines[0];
    expect(kept.prep?.lines.map((l) => l.name)).toContain('Spruce tips');
    expect(kept.prep?.at).toBeTruthy();
    expect(screen.getByText('Recipe to finish')).toBeTruthy();
  });

  test('on a phone the search takes the page, and Cancel gives it back', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'House Negroni', lines: [{ key: 'k1', id: 'gin', name: 'Gin', amount: '30', unit: 'ml' }] });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent(screen.getByLabelText('Add another ingredient'), 'focus');
    expect(screen.getByText('Adding to House Negroni')).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Method: / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Back to / })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel, add nothing' }));
    expect(screen.getByRole('button', { name: /^Method: / })).toBeTruthy();
  });

  test('with no name yet, adding an ingredient leaves the cursor off the name', async () => {
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.autoFocus).toBe(true);
    await fireEvent(screen.getByLabelText('Add an ingredient'), 'focus');
    await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'gin');
    await fireEvent.press(screen.getByRole('button', { name: 'Gin' }));
    expect(screen.getByRole('button', { name: /Gin\. Edit$/ })).toBeTruthy();
    expect(screen.getByLabelText('Name').props.autoFocus).toBe(false);
  });

  test('the Colour row picks the drawing’s colour, and goes when a photo takes its place', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'House Negroni' });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByRole('button', { name: 'Colour: Auto' })).toBeTruthy();
    await act(async () => useDrinkWizardStore.getState().patch('home', { photos: { hero: 'a.jpg' } }));
    expect(screen.queryByRole('button', { name: /^Colour: / })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep the drawing, after the photos' }));
    expect(screen.getByRole('button', { name: 'Colour: Auto' })).toBeTruthy();
  });

  test('a prompt put away stays away for this draft', async () => {
    useDrinkWizardStore.getState().patch('home', { name: 'Sour', lines: [{ key: 'k1', id: 'gin', name: 'Gin', amount: '60', unit: 'ml' }, { key: 'k2', id: null, name: 'Lemon Juice', amount: '30', unit: 'ml', named: true }] });
    await renderWithProviders(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    const title = 'Sour with nothing sweet.';
    expect(screen.getByText(title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText(title)).toBeNull();
    expect(useDrinkWizardStore.getState().kept.home.draft.putAway).toHaveLength(1);
  });
});
