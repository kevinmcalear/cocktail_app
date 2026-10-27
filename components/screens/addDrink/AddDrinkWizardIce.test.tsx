import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
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
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: mockClosest }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: [] }), useShelfEdit: () => ({ add: { mutate: jest.fn() }, remove: { mutate: jest.fn() } }) }));
jest.mock('@/hooks/useIngredientUse', () => ({ useIngredientUse: () => ({ data: 0 }) }));
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
// The wave 2 ice and method steps (Q21 + E24, Q20b): Shaken with under the method, the ice picked straight away.
describe('AddDrinkWizard ice and method', () => {
  test('the ice is picked straight away, and whole builds are in Add extra ice', async () => {
    mockVenueIce = [{ name: 'Shaved', shape: 'shaved', draw_as: null }, { name: 'Large cube', shape: 'large', draw_as: null }];
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Julep' });
    useDrinkWizardStore.getState().setStep('bar-1', 'ice');
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    // No One kind or quick builds on the step (Q21 + E24): the ice is picked straight away.
    expect(screen.queryByRole('radio', { name: 'One kind' })).toBeNull();
    // Cubes start at 3, and the quick builds are in Add extra ice.
    await fireEvent.press(screen.getByRole('radio', { name: 'Cubes' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.iceBuild).toEqual([{ ice: expect.objectContaining({ name: 'Cubes' }), n: 3 }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add extra ice' }));
    expect(screen.getByText('OR A WHOLE BUILD')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dump the tin' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Spear on cubes' }));
    expect(useDrinkWizardStore.getState().kept['bar-1'].draft.iceBuild?.map((l) => l.ice.name)).toEqual(['Cubes', 'Spear']);
  });

  test('the method says what it is shaken with, from the venue’s cubes, and not for a built drink', async () => {
    mockVenueIce = [{ name: 'Large cube', shape: 'large', draw_as: null }, { name: 'Hosh cubes', shape: 'cubes', draw_as: null }];
    useDrinkWizardStore.getState().patch('bar-1', { name: 'Daiquiri', methods: [{ id: null, name: 'Shake' }] });
    useDrinkWizardStore.getState().setStep('bar-1', 'method');
    await renderWithTamagui(<AddDrinkWizard barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    expect(screen.getByText('Shaken with hosh cubes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change what it’s shaken with' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Shake' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Build' }));
    expect(screen.queryByText(/shaken with/i)).toBeNull();
    // The whisk is in Air and texture, and takes no ice.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Whip (whisk or frother)' }));
    expect(screen.queryByText(/with hosh cubes/i)).toBeNull();
  });

  test('made in parts: the switch splits the drink, and a line moves to the part it is tapped in', async () => {
    useDrinkWizardStore.getState().patch('home', {
      name: 'Irish Coffee',
      lines: [{ key: 'w', id: null, name: 'Irish whiskey', amount: '40', unit: 'ml' }, { key: 'c', id: null, name: 'Cream', amount: '30', unit: 'ml' }],
      methods: [{ id: 'm-build', name: 'Build' }],
    });
    useDrinkWizardStore.getState().setStep('home', 'method');
    await renderWithTamagui(<AddDrinkWizard onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut();
    await fireEvent(screen.getByRole('switch', { name: 'Made in parts' }), 'valueChange', true);
    const parts = () => useDrinkWizardStore.getState().kept.home.draft.parts ?? [];
    expect(parts().map((p) => p.lines)).toEqual([['w', 'c'], []]);
    expect(screen.queryByRole('list', { name: 'In order' })).toBeNull();
    // Part 2's chips come second.
    await fireEvent.press(screen.getAllByRole('checkbox', { name: 'Cream' })[1]);
    expect(parts().map((p) => p.lines)).toEqual([['w'], ['c']]);
    await fireEvent.press(screen.getAllByRole('checkbox', { name: 'Stir' })[1]);
    expect(useDrinkWizardStore.getState().kept.home.draft.methods.map((m) => m.name)).toEqual(['Build', 'Stir']);
    await fireEvent(screen.getByRole('switch', { name: 'Made in parts' }), 'valueChange', false);
    expect(useDrinkWizardStore.getState().kept.home.draft.parts).toBeNull();
    expect(useDrinkWizardStore.getState().kept.home.draft.methods.map((m) => m.name)).toEqual(['Build', 'Stir']);
  });
});
