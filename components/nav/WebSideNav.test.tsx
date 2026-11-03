import { act, fireEvent, screen } from '@testing-library/react-native';

import { WebSideNav } from '@/components/nav/WebSideNav';
import { renderWithProviders } from '@/jest.setup';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';

const mockNavigate = jest.fn();
let mockPathname = '/';
let mockMode: 'venue' | 'home' = 'venue';

let mockSegments: string[] = [];
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useSegments: () => mockSegments,
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));
const mockSetMode = jest.fn();
const mockEnterVenue = jest.fn();
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: mockSetMode }) }));
const mockVenue = { id: 'caretakers', name: 'Caretakers', logoUrl: null, accent: null, displayFace: 'redaction', groundTint: null, roleLevel: 40 };

const mockOther = { ...mockVenue, id: 'pale', name: 'Pale Moth', roleLevel: 30 };
let mockActive: typeof mockVenue | null = mockVenue;
let mockLoading = false;
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: mockActive, venues: mockActive ? [mockVenue, mockOther] : [], enterVenue: mockEnterVenue, isLoading: mockLoading }) }));
jest.mock('@/hooks/useHomeBar', () => ({ useShelf: () => ({ data: ['a', 'b', 'c'] }) }));
jest.mock('@/components/ui/UserAvatar', () => ({ CurrentUserAvatar: () => null, useUserDisplayName: () => 'Kevin McAlear' }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole, useCanManageStaff: () => mockRole >= 40 }));
// These read the signed-in person's venues from Supabase; the nav doesn't need them here.
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: unknown }) => children }));
// Add reads where things land and the clipboard; the sheet itself is what's checked here.
jest.mock('@/hooks/useBringInPlace', () => ({ useBringInPlace: () => ({ barId: null, venueName: null, heldBack: null, loading: false }) }));
jest.mock('@/lib/clipboardPeek', () => ({ UNREAD_CLIP: '\u0000unread', peekClipboard: async () => null, readClipboard: async () => null }));
jest.mock('@/hooks/useDrinkDesk', () => ({ useMenuSectionPlace: () => ({ data: undefined }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [{ id: 'd1' }, { id: 'd2' }] }) }));
let mockCaps = ['edit_drinks', 'brand'];
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }), useCapabilityOpensAt: () => ({ data: 35 }) }));
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => ({ venueId: 'caretakers', canAdd: true, label: 'Caretakers' }) }));
// The notes beside the rows: one menu on now, no house-made low.
jest.mock('@/hooks/useMenus', () => ({ useVenueMenus: () => ({ data: [{ id: 'm1', name: 'Autumn', barId: 'caretakers', kind: 'menu', startsAt: '2020-01-01T00:00:00Z', endsAt: null, itemIds: [] }] }) }));
jest.mock('@/hooks/usePrepList', () => ({ usePrepData: () => ({ data: undefined }) }));
const mockPush = jest.fn();

// The keyboard test lends the sidebar a document; take it back once every render has unmounted.
afterAll(() => delete (globalThis as { document?: unknown }).document);

const links = () => screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);

beforeEach(() => {
  mockNavigate.mockClear();
  mockPush.mockClear();
  mockRole = 40;
  mockCaps = ['edit_drinks', 'brand'];
  mockMode = 'venue';
  mockActive = mockVenue;
  mockLoading = false;
  mockSetMode.mockClear();
});

test('venue mode lists search, the four tabs and the venue pages, marking the current one', async () => {
  mockMode = 'venue';
  mockPathname = '/drinks';
  await renderWithProviders(<WebSideNav />);

  // Board Prod-desk: the four tabs, the bar's group (the menu on now, House-made, Team, Bar settings), and you at the foot.
  // Only the place you're in: no Home group under the bar's. Every person and role has the same tabs (tabs A, 31 Oct).
  expect(links()).toEqual(['Tonight', 'Drinks', 'Discover', 'You', 'Autumn, on now', 'House-made', 'Team', 'Bar settings', 'You: Kevin M., Admin at Caretakers']);
  expect(screen.getByRole('link', { name: 'Drinks', selected: true })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Tonight', selected: false })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'House-made' }));
  expect(mockPush).toHaveBeenLastCalledWith('/prep');
  await fireEvent.press(screen.getByRole('link', { name: 'Autumn, on now' }));
  expect(mockPush).toHaveBeenLastCalledWith('/menus/all');
  await fireEvent.press(screen.getByRole('link', { name: 'Bar settings' }));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/caretakers');
  // You is a tab, and the foot opens it too.
  await fireEvent.press(screen.getByRole('link', { name: 'You: Kevin M., Admin at Caretakers' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/you');
});

test('the place chip is where you switch place; no mark row tops the sidebar', async () => {
  await renderWithProviders(<WebSideNav />);
  // Board C7/C8: the one chip, the bar's, opens the places menu (VenueSwitcher's, tested on its own). Home is in that menu, not under the bar.
  expect(screen.getByRole('button', { name: 'Caretakers. Switch place' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Home. Switch place' })).toBeNull();
  // Search is the first control: nothing (no mark, no switcher) sits above it.
  expect(screen.getAllByRole('button')[0].props.accessibilityLabel).toBe('Search');
  expect(screen.queryByRole('radio', { name: 'Pale Moth, Bartender' })).toBeNull();
});

test("on no bar's team, Home is the place even in venue mode; its Menus switches to home first", async () => {
  mockActive = null;
  await renderWithProviders(<WebSideNav />);
  expect(links()).toEqual(['Tonight', 'Drinks', 'Discover', 'You', 'Shelf, 3', 'Menus', 'You: Kevin M., Home bar · 3 bottles']);
  await fireEvent.press(screen.getByRole('link', { name: 'Menus' }));
  expect(mockSetMode).toHaveBeenLastCalledWith('home');
});

test('while the bar is loading, no place chip or group shows, so it never names the wrong place', async () => {
  mockActive = null;
  mockLoading = true;
  await renderWithProviders(<WebSideNav />);
  expect(screen.queryByRole('button', { name: /Switch place/ })).toBeNull();
  expect(links().slice(0, 4)).toEqual(['Tonight', 'Drinks', 'Discover', 'You']);
  expect(screen.queryByRole('link', { name: /Shelf/ })).toBeNull();
});

test('a drink opened cold lights the tab its stack is in', async () => {
  mockPathname = '/cocktail/1';
  mockSegments = ['(tabs)', '(1-tonight)', 'cocktail', '[id]'];
  await renderWithProviders(<WebSideNav />);
  expect(screen.getByRole('link', { name: 'Tonight', selected: true })).toBeTruthy();
  mockSegments = [];
});

test('the sidebar has no New row: + Add and the N key open New', async () => {
  await renderWithProviders(<WebSideNav />);
  expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
});

test('a page off the nav keeps the row it was opened from lit', async () => {
  mockPathname = '/drinks';
  const view = await renderWithProviders(<WebSideNav />);
  mockPathname = '/add-cocktail';
  await view.rerender(<WebSideNav />);
  expect(screen.getByRole('link', { name: 'Drinks', selected: true })).toBeTruthy();
});

test('Menus stays marked on a menu page', async () => {
  mockMode = 'venue';
  mockPathname = '/menus/abc';
  await renderWithProviders(<WebSideNav />);
  expect(screen.getByRole('link', { name: 'Autumn, on now', selected: true })).toBeTruthy();
});

test('an employee opens My team from the sidebar', async () => {
  mockRole = 20;
  await renderWithProviders(<WebSideNav />);
  await fireEvent.press(screen.getByRole('link', { name: 'Team' }));
  expect(mockPush).toHaveBeenLastCalledWith('/team');
});

test('a guest does not see My team', async () => {
  mockRole = 10;
  await renderWithProviders(<WebSideNav />);
  expect(screen.queryByRole('link', { name: 'Team' })).toBeNull();
});

test('home mode lists the same four tabs and navigates to their routes', async () => {
  mockMode = 'home';
  mockPathname = '/discover';
  await renderWithProviders(<WebSideNav />);

  // No bar group at home: Home's Shelf and Menus under the Home chip; the foot says your shelf.
  expect(links()).toEqual(['Tonight', 'Drinks', 'Discover', 'You', 'Shelf, 3', 'Menus', 'You: Kevin M., Home bar · 3 bottles']);
  expect(screen.getByRole('button', { name: 'Home. Switch place' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Caretakers. Switch place' })).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: 'Menus' }));
  expect(mockPush).toHaveBeenLastCalledWith('/menus/all');
  expect(mockSetMode).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Discover', selected: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'Discover' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/discover');
  await fireEvent.press(screen.getByRole('link', { name: 'Tonight' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
});

test('Search opens the search over the current page instead of leaving it', async () => {
  useSearchPalette.setState({ open: false });
  await renderWithProviders(<WebSideNav />);
  await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
  expect(useSearchPalette.getState().open).toBe(true);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Search', selected: true })).toBeTruthy();
});

test('New opens Add with the drafts to pick up, and its last row the other starts, made where you are', async () => {
  mockMode = 'venue';
  mockPathname = '/';
  let onKey: (e: Partial<KeyboardEvent>) => void = () => {};
  (globalThis as { document?: unknown }).document = { addEventListener: (_: string, fn: typeof onKey) => (onKey = fn), removeEventListener: () => {} };
  const pressN = () => act(() => onKey({ key: 'n', target: { tagName: 'DIV' } as unknown as EventTarget, preventDefault: () => {} }));
  await renderWithProviders(<WebSideNav />);

  await pressN();
  expect(await screen.findByLabelText('Name a drink, paste a link, or describe it')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Drafts. 2 from the older editor' }));
  expect(mockPush).toHaveBeenLastCalledWith('/drafts');

  await pressN();
  await fireEvent.press(await screen.findByRole('button', { name: /^Something else/ }));
  expect(await screen.findByText('Made at Caretakers, for its drinks')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Something you make. A batch, syrup, infusion, cordial: anything with a recipe' }));
  // Made at the venue you're in, not your home bar.
  expect(mockPush).toHaveBeenLastCalledWith('/make-recipe?barId=caretakers');
});

test('N toggles Add, but not while typing in a field', async () => {
  // Jest runs without a DOM, so hand the sidebar a document that keeps its key listener.
  let onKey: (e: Partial<KeyboardEvent>) => void = () => {};
  (globalThis as { document?: unknown }).document = { addEventListener: (_: string, fn: typeof onKey) => (onKey = fn), removeEventListener: () => {} };
  const press = (target: { tagName: string }) => act(() => onKey({ key: 'n', target: target as unknown as EventTarget, preventDefault: () => {} }));
  const field = () => screen.queryByLabelText('Name a drink, paste a link, or describe it');
  await renderWithProviders(<WebSideNav />);
  await press({ tagName: 'INPUT' });
  expect(field()).toBeNull();
  await press({ tagName: 'BODY' });
  expect(await screen.findByLabelText('Name a drink, paste a link, or describe it')).toBeTruthy();
  await press({ tagName: 'BODY' });
  expect(field()).toBeNull();
});

test('⇧⌘8 opens the eight ball over the page on the web, closing the search', async () => {
  let onKey: (e: Partial<KeyboardEvent>) => void = () => {};
  (globalThis as { document?: unknown }).document = { addEventListener: (_: string, fn: typeof onKey) => (onKey = fn), removeEventListener: () => {} };
  const preventDefault = jest.fn();
  useSearchPalette.setState({ open: true });
  useEightBallStore.setState({ open: false });
  await renderWithProviders(<WebSideNav />);
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
