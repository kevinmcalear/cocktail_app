import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { checklist } from '@/lib/setupChecklist';

import { SetupChecklist } from './SetupChecklist';

const [mockPush, mockNavigate, mockSkip, mockSetReviewing, mockStart] = [jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn()];
let mockRun: { finished: boolean; done: string[] } | undefined = { finished: true, done: [] };
const BARE = { logo_url: null, primary_color: null, display_face: 'instrument_serif' };
let mockBrand: typeof BARE | { logo_url: null; primary_color: string; display_face: string } = BARE;
let mockDrinks: { inLibrary: number; reviewId: string | null } = { inLibrary: 0, reviewId: null };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('@/components/screens/firstRound/FirstCocktailChoices', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    useStartFirstCocktail: () => mockStart,
    FirstCocktailChoices: ({ onPick }: { onPick: (start: string | null) => void }) => (
      <Pressable role="button" onPress={() => onPick('Margarita')}>
        <Text>Margarita</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/store/useBringIn', () => ({ useBringIn: { getState: () => ({ setReviewing: mockSetReviewing }) } }));
let mockBrandLoading = false;
jest.mock('@/hooks/useVenueBrand', () => ({ useVenueBrand: () => (mockBrandLoading ? { data: undefined, isLoading: true } : { data: mockBrand }) }));
// How it looks, opened from Your team: a setup page whose footer saves and goes on.
jest.mock('@/components/screens/venue/BrandScreen', () => {
  const { SetupPage } = jest.requireActual('@/components/screens/onboarding/SetupPage');
  return {
    BrandSetup: ({ setup }: { setup: { footer: (s: { save: (then: () => void) => void; saving: boolean; ok: boolean }) => unknown } }) => (
      <SetupPage footer={setup.footer({ save: (then) => then(), saving: false, ok: true })}>{null}</SetupPage>
    ),
  };
});
jest.mock('@/hooks/useBarGlassware', () => ({ useBarPageId: () => ({ data: 'page' }), useFlushHeldGlasses: () => {} }));
jest.mock('@/hooks/useSetupChecklist', () => ({
  useSetupChecklist: () => ({
    run: mockRun,
    list: jest.requireActual('@/lib/setupChecklist').checklist({ bar: true, kit: false, bottles: false, menu: true, drinks: false, team: false }, ['team']),
    notes: { menu: 'Autumn menu' },
    menuId: 'm1',
    ...mockDrinks,
    loading: false,
    skip: mockSkip,
  }),
}));
jest.mock('./SetupChecklistParts', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    FromDrinksRow: () => null,
    ChecklistRow: ({ title, line, note, state, onPress }: { title: string; line: string; note?: string; state: string; onPress: () => void }) => (
      <Pressable role="button" accessibilityLabel={`${title}, ${state}`} onPress={onPress}>
        <Text>{[line, note].filter(Boolean).join(' · ')}</Text>
      </Pressable>
    ),
    ClaimNote: () => null,
    LookFirstNote: () => <Text>Your team’s invite wears this</Text>,
  };
});
// The steps it opens in place: each hands back with Next, Done or Back.
jest.mock('./KitStep', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    KitStep: ({ step, onBack, onDone }: { step: string; onBack: () => void; onDone: () => void }) => (
      <>
        <Text>{step}</Text>
        <Pressable role="button" accessibilityLabel="Back" onPress={onBack} />
        <Pressable role="button" accessibilityLabel="Done, back to setup" onPress={onDone} />
      </>
    ),
  };
});
jest.mock('./BrandsStep', () => ({ BrandsStep: () => null }));
jest.mock('./MenuStep', () => ({ MenuStep: () => null }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/hooks/useKitFromDrinks', () => ({ useKitFromDrinks: () => null }));
jest.mock('./FromDrinksStep', () => ({ FromDrinksStep: () => null, fromDrinksCount: () => null }));
jest.mock('./TeamStep', () => {
  const { Text } = jest.requireActual('react-native');
  return { TeamStep: () => <Text>Team step</Text> };
});

beforeEach(() => {
  mockRun = { finished: true, done: [] };
  mockBrand = BARE;
  mockBrandLoading = false;
  mockDrinks = { inLibrary: 0, reviewId: null };
  for (const m of [mockPush, mockNavigate, mockSkip, mockSetReviewing, mockStart]) m.mockReset();
});

test('six rows, Kit next; Kit opens in place and comes back here', async () => {
  expect(checklist({ bar: true, kit: false, bottles: false, menu: true, drinks: false, team: false }, ['team']).next).toBe('kit');
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Set up Little Rye')).toBeTruthy();
  expect(screen.getByText('Two of six done. Each one brings you back here.')).toBeTruthy();
  for (const row of ['Basic information, done', 'Kit, now', 'Bottles, todo', 'First menu, done', 'First drinks, todo', 'Your team, skipped']) expect(screen.getByRole('button', { name: row })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Kit, now' }));
  expect(screen.getByText('Set up Little Rye · Kit')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Kit, now' })).toBeTruthy();
  expect(mockSkip).not.toHaveBeenCalled();
  // Done with nothing in the kit leaves the row for later, and comes back here too.
  await fireEvent.press(screen.getByRole('button', { name: 'Kit, now' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done, back to setup' }));
  expect(mockSkip).toHaveBeenCalledWith('kit');
  expect(screen.getByRole('button', { name: 'Kit, now' })).toBeTruthy();
});

test('pages it opens: Basic information (Venue settings once setup is through, else setup where it stopped) and the menu for First drinks', async () => {
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Basic information, done' }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1');
  await fireEvent.press(screen.getByRole('button', { name: 'First drinks, todo' }));
  expect(mockPush).toHaveBeenLastCalledWith('/menus/m1/edit');
});

test('setup not through yet: Basic information picks venue setup up', async () => {
  mockRun = { finished: false, done: ['find', 'place'] };
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Basic information, done' }));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1');
});

test('First drinks (E31): an import left part way carries on', async () => {
  mockDrinks = { inLibrary: 18, reviewId: 'r1' };
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'First drinks, todo' }));
  expect(mockSetReviewing).toHaveBeenCalledWith('r1');
  expect(mockPush).toHaveBeenLastCalledWith('/bring-in');
});

test('First drinks (E31): with nothing left to check, the drinks in the Library', async () => {
  mockDrinks = { inLibrary: 18, reviewId: null };
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'First drinks, todo' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/library');
});

test('First drinks not done: the four starts under it, coming back to the checklist once saved', async () => {
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Margarita' }));
  expect(mockStart).toHaveBeenCalledWith('b1', 'Margarita', true);
});

test('Your team waits for How it looks: it opens the look first, then the team', async () => {
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('After how Little Rye looks: the invite wears it')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Your team, skipped' }));
  expect(screen.getByText('Your team’s invite wears this')).toBeTruthy();
  expect(screen.getByText('How Little Rye looks')).toBeTruthy();
  await fireEvent.press(screen.getByText('Done, on to your team'));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('with a look set, Your team goes straight to the invites', async () => {
  mockBrand = { logo_url: null, primary_color: '#D0643B', display_face: 'instrument_serif' };
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Invite who works here, in Little Rye’s look')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Your team, skipped' }));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('the rows wait for the look to load, so Your team can\'t skip the gate', async () => {
  mockBrandLoading = true;
  await renderWithTamagui(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Loading…')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Your team, skipped' })).toBeNull();
});
