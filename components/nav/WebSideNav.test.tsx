import { act, fireEvent, screen } from '@testing-library/react-native';

import { WebSideNav } from '@/components/nav/WebSideNav';
import { renderWithTamagui } from '@/jest.setup';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

const mockNavigate = jest.fn();
let mockPathname = '/';
let mockMode: 'venue' | 'home' = 'venue';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));
const mockSetMode = jest.fn();
const mockEnterVenue = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: mockSetMode }) }));
const mockVenue = { id: 'caretakers', name: 'Caretakers', logoUrl: null, accent: null, displayFace: 'instrument', groundTint: null, roleLevel: 40 };
// The venue's switches come from their own query (hooks/useVenueFeatures.ts); here, a list per test.
let mockFeatures: string[] = [];
jest.mock('@/hooks/useVenueFeatures', () => {
  const { featureAtHome } = jest.requireActual<typeof import('@/lib/venueFeatures')>('@/lib/venueFeatures');
  const features = () => ({ ready: true, home: mockMode === 'home', has: (k: never) => (mockMode === 'home' ? featureAtHome(k) : mockFeatures.includes(k)) });
  return { useVenueFeatures: features, useVenueFeature: (k: never) => features().has(k) };
});

const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockVenue, venues: [mockVenue, mockOther], enterVenue: mockEnterVenue }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: ['a', 'b', 'c'] }) }));
jest.mock('@/components/ui/UserAvatar', () => ({ CurrentUserAvatar: () => null, useUserDisplayName: () => 'Kevin McAlear' }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole, useCanManageStaff: () => mockRole >= 40 }));
// These read the signed-in person's venues from Supabase; the nav doesn't need them here.
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: unknown }) => children }));
jest.mock('@/components/nav/VenueSwitcher', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { VenueSwitcher: () => <Text>venue switcher</Text> };
});
jest.mock('@/hooks/useFeatureNews', () => ({ useFeatureNewsDots: () => [] }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [{ id: 'd1' }, { id: 'd2' }] }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: ['edit_drinks'] }), useCapabilityOpensAt: () => ({ data: 35 }) }));
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => ({ venueId: 'caretakers', canAdd: true, label: 'Caretakers' }) }));
jest.mock('@/components/screens/week/WeekNav', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { WeekNav: () => <Text>this week list</Text> };
});
const mockPush = jest.fn();

// The keyboard test lends the sidebar a document; take it back once every render has unmounted.
afterAll(() => delete (globalThis as { document?: unknown }).document);

const links = () => screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);

beforeEach(() => {
  mockNavigate.mockClear();
  mockPush.mockClear();
  mockRole = 40;
  mockMode = 'venue';
  // Tonight, Back bar and History switched on; the first test turns them off.
  mockFeatures = ['tonight', 'backBar', 'history'];
});

test('a venue with nothing switched on has Library, Menus and Discover, and its Venue section', async () => {
  mockFeatures = [];
  mockPathname = '/library';
  await renderWithTamagui(<WebSideNav />);
  expect(links()).toEqual(['Library', 'Menus', 'Discover', 'Glassware', 'My team', 'Features', 'Brand', 'Roles and access', 'Venue settings', 'You: Kevin M., Admin at Caretakers']);
  expect(screen.queryByText('this week list')).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: 'Menus' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/menus');
});

test('venue mode lists search and the venue tabs, marking the current one', async () => {
  mockMode = 'venue';
  mockPathname = '/library';
  await renderWithTamagui(<WebSideNav />);

  // The canvas order: the tabs and History, Back bar, then the Venue section and you at the foot.
  expect(links()).toEqual(['Tonight', 'Library', 'Menus', 'Discover', 'History', 'Back bar', 'Glassware', 'My team', 'Features', 'Brand', 'Roles and access', 'Venue settings', 'You: Kevin M., Admin at Caretakers']);
  expect(screen.getByText('this week list')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Library', selected: true })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Tonight', selected: false })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'Back bar' }));
  expect(mockPush).toHaveBeenLastCalledWith('/back-bar');
  await fireEvent.press(screen.getByRole('link', { name: 'Menus' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/menus');
  await fireEvent.press(screen.getByRole('link', { name: 'Brand' }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/caretakers/brand');
  await fireEvent.press(screen.getByRole('link', { name: 'Venue settings' }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/caretakers');
  // Pages have no avatar on wide web, so You lives in the foot.
  await fireEvent.press(screen.getByRole('link', { name: 'You: Kevin M., Admin at Caretakers' }));
  expect(mockPush).toHaveBeenLastCalledWith('/you');
});

test('the top of the sidebar is one mark with a chevron (the switcher), never a row of venues', async () => {
  await renderWithTamagui(<WebSideNav />);
  // Kevin, 13 Oct: one mark with an arrow that opens the venue menu (VenueSwitcher, tested on its own).
  expect(screen.getByText('venue switcher')).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Pale Moth, Bartender' })).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Home bar' })).toBeNull();
});

test('a page off the nav keeps the row it was opened from lit', async () => {
  mockPathname = '/library';
  const view = await renderWithTamagui(<WebSideNav />);
  mockPathname = '/add-cocktail';
  await view.rerender(<WebSideNav />);
  expect(screen.getByRole('link', { name: 'Library', selected: true })).toBeTruthy();
});

test('Menus stays marked on a menu page', async () => {
  mockMode = 'venue';
  mockPathname = '/menus/abc';
  await renderWithTamagui(<WebSideNav />);
  expect(screen.getByRole('link', { name: 'Menus', selected: true })).toBeTruthy();
});

test('an employee opens My team from the sidebar', async () => {
  mockRole = 20;
  await renderWithTamagui(<WebSideNav />);
  await fireEvent.press(screen.getByRole('link', { name: 'My team' }));
  expect(mockPush).toHaveBeenLastCalledWith('/team');
});

test('a guest does not see My team', async () => {
  mockRole = 10;
  await renderWithTamagui(<WebSideNav />);
  expect(screen.queryByRole('link', { name: 'My team' })).toBeNull();
});

test('home mode lists the home tabs and navigates to their routes', async () => {
  mockMode = 'home';
  mockPathname = '/discover';
  await renderWithTamagui(<WebSideNav />);

  // No Venue section at home; the foot says your shelf.
  expect(links()).toEqual(['Discover', 'History', 'My Bar', 'Collection', 'You', 'You: Kevin M., Home bar · 3 bottles']);
  expect(screen.getByRole('link', { name: 'Discover', selected: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'Discover' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/discover');
  await fireEvent.press(screen.getByRole('link', { name: 'My Bar' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/bar');
});

test('Search opens the search over the current page instead of leaving it', async () => {
  useSearchPalette.setState({ open: false });
  await renderWithTamagui(<WebSideNav />);
  await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
  expect(useSearchPalette.getState().open).toBe(true);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Search', selected: true })).toBeTruthy();
});

test('New opens the create sheet with the draft count, and each choice goes where it is made', async () => {
  mockMode = 'venue';
  mockPathname = '/';
  await renderWithTamagui(<WebSideNav />);

  await fireEvent.press(screen.getByRole('button', { name: 'New' }));
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('Made at Caretakers, for its library')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Something you make. A batch, syrup, infusion, cordial: anything with a recipe' }));
  // Made at the venue you're in, not your home bar.
  expect(mockPush).toHaveBeenLastCalledWith('/make-recipe?barId=caretakers');

  await fireEvent.press(screen.getByRole('button', { name: 'New' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Drafts. Pick up where you left off' }));
  expect(mockPush).toHaveBeenLastCalledWith('/drafts');
});


test('N toggles the create sheet, but not while typing in a field', async () => {
  // Jest runs without a DOM, so hand the sidebar a document that keeps its key listener.
  let onKey: (e: Partial<KeyboardEvent>) => void = () => {};
  (globalThis as { document?: unknown }).document = { addEventListener: (_: string, fn: typeof onKey) => (onKey = fn), removeEventListener: () => {} };
  const press = (target: { tagName: string }) => act(() => onKey({ key: 'n', target: target as unknown as EventTarget, preventDefault: () => {} }));
  await renderWithTamagui(<WebSideNav />);
  await press({ tagName: 'INPUT' });
  expect(screen.queryByText('2')).toBeNull();
  await press({ tagName: 'BODY' });
  expect(screen.getByText('2')).toBeTruthy();
  await press({ tagName: 'BODY' });
  expect(screen.queryByText('2')).toBeNull();
});

test('⇧⌘8 opens the eight ball over the page on the web, closing the search', async () => {
  let onKey: (e: Partial<KeyboardEvent>) => void = () => {};
  (globalThis as { document?: unknown }).document = { addEventListener: (_: string, fn: typeof onKey) => (onKey = fn), removeEventListener: () => {} };
  const preventDefault = jest.fn();
  useSearchPalette.setState({ open: true });
  useEightBallStore.setState({ open: false });
  await renderWithTamagui(<WebSideNav />);
  // A bare 8 is typing, not the shortcut.
  await act(() => onKey({ key: '8', code: 'Digit8', target: { tagName: 'BODY' } as unknown as EventTarget, preventDefault }));
  expect(useEightBallStore.getState().open).toBe(false);
  // Plain ⌘8 stays the browser's eighth tab.
  await act(() => onKey({ key: '8', code: 'Digit8', metaKey: true, preventDefault }));
  expect(useEightBallStore.getState().open).toBe(false);
  await act(() => onKey({ key: '*', code: 'Digit8', metaKey: true, shiftKey: true, preventDefault }));
  expect(useEightBallStore.getState().open).toBe(true);
  expect(useSearchPalette.getState().open).toBe(false);
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
