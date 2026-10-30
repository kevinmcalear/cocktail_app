import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import { moveImportsOut, useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddDrinkWizard } from './AddDrinkWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();
let mockBarGlasses: unknown[] = [];
let mockVenueIce: unknown[] = [];
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('./NearNameCard', () => ({ NearNameCard: () => null }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }), useUserId: () => 'me' }));
let mockClosest: { id: string; name: string } | null = null;
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: mockClosest }), useCloseClassics: () => ({ data: [] }) }));
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
// A venue's suppliers and costs (m01) read their own hooks; these tests are about the steps.
jest.mock('./useDeskLines', () => ({ ...jest.requireActual('./useDeskLines'), useVenueLines: () => ({ lines: {}, cost: null }) }));
beforeEach(() => {
  mockCreate.mockReset();
  mockStart.mockReset();
  mockSaved.mockReset();
  mockBarGlasses = [];
  mockVenueIce = [];
  mockClosest = null;
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ defaultUnit: 'ml' });
});
// iOS draws the screen after its first layout (the keyboard offset needs it).
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
// An import's Edit this drink (lib/importReview): the draft begins as the spec read from the file (Eddie, 26 Oct).
const imported = { ...EMPTY_DRAFT, name: 'Feijoa Smash', lines: [{ key: 'k1', id: null, name: 'Feijoa', amount: '30', unit: 'ml' }] };

describe('AddDrinkWizard from an import', () => {
  test('opens at the first step with no "Picked up where you left off"', async () => {
    useDrinkWizardStore.getState().begin('bar-1|review:r1#0', imported);
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" imported review="r1#0" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('Feijoa Smash');
    expect(screen.queryByText('Picked up where you left off.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
  });

  test('picked up again later, Start over goes back to the spec as read, not to nothing', async () => {
    // Edit all keeps it as a draft by name, opened again from New's Drafts.
    const slot = 'bar-1|name:feijoa smash';
    useDrinkWizardStore.getState().begin(slot, imported);
    useDrinkWizardStore.getState().patch(slot, { name: 'Feijoa Fizz', lines: [] });
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" initialName="feijoa smash" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('Feijoa Fizz');
    await fireEvent.press(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByLabelText('Name').props.value).toBe('Feijoa Smash');
    const kept = useDrinkWizardStore.getState().kept[slot];
    expect(kept.draft.lines).toEqual(imported.lines);
    expect(kept.step).toBe('name');
    expect(kept.start?.name).toBe('Feijoa Smash');
  });

  // Eddie, 29 Oct: New drink kept opening a drink from an import he hadn't finished.
  test('a plain New drink opens empty while an import’s drink waits in its own slot', async () => {
    useDrinkWizardStore.getState().begin('bar-1|review:r1#0', imported);
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('');
    expect(screen.queryByText('Picked up where you left off.')).toBeNull();
  });

  test('an import an older version left in the plain slot moves to a draft by name', async () => {
    useDrinkWizardStore.getState().begin('bar-1', imported);
    moveImportsOut();
    const { kept, cleared } = useDrinkWizardStore.getState();
    expect(kept['bar-1']).toBeUndefined();
    expect(kept['bar-1|name:feijoa smash'].draft.name).toBe('Feijoa Smash');
    expect(cleared.map((c) => c.place)).toContain('bar-1');
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByLabelText('Name').props.value).toBe('');
  });

  test('a draft that began empty still clears on Start over', async () => {
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Paloma' });
    useDrinkWizardStore.getState().restart('bar-1');
    expect(useDrinkWizardStore.getState().kept['bar-1']).toBeUndefined();
  });
});
