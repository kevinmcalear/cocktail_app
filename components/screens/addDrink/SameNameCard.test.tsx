import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { renderWithProviders } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import { nameWaits } from '@/lib/sameName';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';
import { useSettingsStore } from '@/store/useSettingsStore';

import { AddDrinkWizard } from './AddDrinkWizard';
import { CreditsStep } from './CreditsStep';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/ds/DrinkImage', () => ({ DrinkImage: () => null }));
jest.mock('@/hooks/useNearNameDrink', () => ({ useNearNameDrink: () => null }));
jest.mock('@/hooks/useSearchNear', () => ({ useSaveSpelling: () => ({ mutate: jest.fn() }) }));

const mockCreate = jest.fn();
let mockBarGlasses: unknown[] = [];
let mockVenueIce: unknown[] = [];
// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [] }));
jest.mock('./NearNameCard', () => ({ NearNameCard: () => null }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, loading: false }), useUserId: () => 'me' }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }), useCloseClassics: () => ({ data: [] }) }));
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
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
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
// The bar (or you, at home) already has a drink by the name, while the name is still its name.
let mockMatch: SameNameDrink | null = null;
jest.mock('@/hooks/useSameNameDrink', () => ({
  useSameNameDrink: ({ barId, mine, name }: { barId?: string | null; mine?: boolean; name: string }) => ({ data: (barId || mine) && mockMatch?.name === name ? mockMatch : null }),
}));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/useDrinkDesk', () => ({ ...jest.requireActual('@/hooks/useDrinkDesk'), useMenuSectionPlace: () => ({ data: undefined }) }));
// A venue's suppliers and costs (m01) read their own hooks; these tests are about the name.
jest.mock('./useDeskLines', () => ({ ...jest.requireActual('./useDeskLines'), useVenueLines: () => ({ lines: {}, cost: null }) }));

const negroni: SameNameDrink = {
  id: 'lr-negroni',
  name: 'Negroni',
  barId: 'bar-1',
  line: 'Gin, Campari, sweet vermouth',
  menu: 'Autumn menu',
  imageUrl: null,
  glass: null,
  classic: { id: 'c-negroni', name: 'Negroni' },
  spec: [],
};

// The draft as each change leaves it.
const changed = jest.fn<void, [WizardDraft]>();
const latest = () => changed.mock.calls[changed.mock.calls.length - 1][0];
const update = (patch: Partial<WizardDraft>) => (d: WizardDraft) => {
  const next = { ...d, ...patch };
  changed(next);
  return next;
};
const kept = (place: string) => useDrinkWizardStore.getState().kept[place].draft;
const laidOut = () => fireEvent(screen.getByTestId('add-drink'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });

/** The draft page with a name already typed: at the bar, or at home. */
async function draftNamed(name: string, barId: string | null = 'bar-1') {
  useDrinkWizardStore.getState().patch(barId ?? 'home', { name });
  await renderWithProviders(<AddDrinkWizard barId={barId} onClose={jest.fn()} onSaved={jest.fn()} />);
  await laidOut();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMatch = null;
  useDrinkWizardStore.setState({ kept: {} });
  useSettingsStore.setState({ defaultUnit: 'ml' });
});

test('at home the prompt is your own drink (Q14b): what it is and when you saved it, and a version is of yours', async () => {
  mockStart.mockImplementation((_id: string, { onSuccess }: { onSuccess: (c: Partial<WizardDraft>) => void }) => onSuccess({ lines: [] }));
  mockMatch = { ...negroni, id: 'my-negroni', barId: null, menu: null, classic: null, glassName: 'Rocks', saved: '12 Oct' };
  await draftNamed('Negroni', null);
  expect(screen.getByText('Did you mean your Negroni?')).toBeTruthy();
  expect(screen.getByText(/^Same name, already here: Rocks · Gin, Campari, sweet vermouth · Saved 12 Oct\./)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open your Negroni. Your draft is kept' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Make this a version' }));
  expect(kept('home').riffOf).toEqual({ id: 'my-negroni', name: 'Negroni' });
  await fireEvent.changeText(screen.getByLabelText('What’s different about this Negroni'), 'less bitter');
  expect(kept('home').name).toBe('Negroni (less bitter)');
});

test('the draft says the bar has one, and a version starts from its spec with a word in brackets', async () => {
  mockStart.mockImplementation((_id: string, { onSuccess }: { onSuccess: (c: Partial<WizardDraft>) => void }) => onSuccess({ lines: [], riffOf: { id: 'lr-negroni', name: 'Negroni' } }));
  mockMatch = negroni;
  await draftNamed('Negroni');
  expect(screen.getByText('Did you mean Little Rye’s Negroni?')).toBeTruthy();
  expect(screen.getByText('Same name, already here: Gin, Campari, sweet vermouth · Autumn menu. A version is the same drink with a different spec.')).toBeTruthy();
  // Save waits on a pick.
  expect(screen.getByText('Pick one for the name first')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save drink', disabled: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Make this a version' }));
  expect(mockStart).toHaveBeenCalledWith('lr-negroni', expect.anything());
  // Linked to the classic Little Rye's is a version of, not to Little Rye's itself.
  expect(kept('bar-1').riffOf).toEqual({ id: 'c-negroni', name: 'Negroni' });
  expect(screen.queryByText('Did you mean Little Rye’s Negroni?')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('What’s different about this Negroni'), 'summer');
  expect(kept('bar-1').name).toBe('Negroni (summer)');
  expect(nameWaits(kept('bar-1'), null)).toBe(false);
  expect(screen.queryByText('Pick one for the name first')).toBeNull();
  expect(screen.getByRole('button', { name: 'Save drink', disabled: false })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Not a version' }));
  expect(kept('bar-1').sameAs).toBeNull();
  // No link to Little Rye's (or its classic) is left for a different drink to carry.
  expect(kept('bar-1').riffOf).toBeNull();
  expect(screen.getByText('Did you mean Little Rye’s Negroni?')).toBeTruthy();
});

test('No, a new drink asks for a name that tells it apart; Open it keeps the draft', async () => {
  mockMatch = negroni;
  await draftNamed('Negroni');
  await fireEvent.press(screen.getByRole('button', { name: 'Open Little Rye’s Negroni. Your draft is kept' }));
  expect(mockPush).toHaveBeenCalledWith('/cocktail/lr-negroni');
  expect(kept('bar-1').name).toBe('Negroni');

  await fireEvent.press(screen.getByRole('button', { name: 'No, a new drink' }));
  expect(screen.queryByText('Did you mean Little Rye’s Negroni?')).toBeNull();
  expect(screen.getByText('Give it a name that tells it apart from Little Rye’s Negroni.')).toBeTruthy();
  expect(nameWaits(kept('bar-1'), negroni)).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Negroni Bianco');
  expect(nameWaits(kept('bar-1'), null)).toBe(false);
  expect(kept('bar-1').riffOf).toBeNull();
  expect(screen.getByRole('button', { name: 'Save drink', disabled: false })).toBeTruthy();
});

test('crediting another bar shows its drink, and a version keeps your spec and asks for the word', async () => {
  const plane = { ...negroni, id: 'tvh-plane', name: 'Paper Plane', line: 'Bourbon, Aperol, Amaro Nonino, lemon', menu: null, classic: null };
  const onRename = jest.fn();
  function Credits() {
    const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Paper Plane', place: { id: 'p-tvh', name: 'The Violet Hour' } });
    return <CreditsStep draft={draft} set={(p) => setDraft(update(p))} venueName={null} ingredients={[]} match={draft.sameAs ? null : plane} onRename={onRename} />;
  }
  await renderWithProviders(<Credits />);
  expect(screen.getByText('Did you mean The Violet Hour’s Paper Plane?')).toBeTruthy();
  expect(screen.getByText('Same name, already here: Bourbon, Aperol, Amaro Nonino, lemon. Open it to save it, rank it or say you made it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Make this a version' }));
  expect(mockStart).not.toHaveBeenCalled();
  expect(latest().sameAs).toMatchObject({ id: 'tvh-plane', as: 'version', bar: 'The Violet Hour' });
  // No classic behind theirs: linked to their drink (the closest link there is today).
  expect(latest().riffOf).toEqual({ id: 'tvh-plane', name: 'Paper Plane' });
  expect(onRename).toHaveBeenCalled();
});
