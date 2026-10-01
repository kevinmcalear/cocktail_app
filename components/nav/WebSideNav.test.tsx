import { fireEvent, screen } from '@testing-library/react-native';

import { WebSideNav } from '@/components/nav/WebSideNav';
import { renderWithTamagui } from '@/jest.setup';

const mockNavigate = jest.fn();
let mockPathname = '/';
let mockMode: 'venue' | 'home' = 'venue';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ active: { id: 'caretakers', name: 'Caretakers' } }) }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole }));
// These read the signed-in person's venues from Supabase; the nav doesn't need them here.
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: unknown }) => children }));
jest.mock('@/components/nav/VenueSwitcher', () => ({ VenueSwitcher: () => null }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [{ id: 'd1' }, { id: 'd2' }] }) }));
const mockPush = jest.fn();

const links = () => screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);

beforeEach(() => {
  mockNavigate.mockClear();
  mockRole = 40;
  mockMode = 'venue';
});

test('venue mode lists search and the venue tabs, marking the current one', async () => {
  mockMode = 'venue';
  mockPathname = '/library';
  await renderWithTamagui(<WebSideNav />);

  expect(links()).toEqual(['Search', 'Tonight', 'Library', 'Prep', 'Study', 'Menus', 'Back bar', 'Station', 'My team']);
  expect(screen.getByRole('link', { name: 'Library', selected: true })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Tonight', selected: false })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'Back bar' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/back-bar');
  await fireEvent.press(screen.getByRole('link', { name: 'Menus' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/menus/all');
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
  expect(mockNavigate).toHaveBeenLastCalledWith('/team');
});

test('a guest does not see My team', async () => {
  mockRole = 10;
  await renderWithTamagui(<WebSideNav />);
  expect(screen.queryByRole('link', { name: 'My team' })).toBeNull();
});

test('home mode lists the home tabs and navigates to their routes', async () => {
  mockMode = 'home';
  mockPathname = '/';
  await renderWithTamagui(<WebSideNav />);

  expect(links()).toEqual(['Search', 'Discover', 'My Bar', 'Collection', 'You']);
  expect(screen.getByRole('link', { name: 'Discover', selected: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('link', { name: 'My Bar' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/bar');
  await fireEvent.press(screen.getByRole('link', { name: 'Search' }));
  expect(mockNavigate).toHaveBeenLastCalledWith('/search');
});

test('New opens the create sheet with the draft count, and each choice goes where it is made', async () => {
  mockMode = 'venue';
  mockPathname = '/';
  await renderWithTamagui(<WebSideNav />);

  await fireEvent.press(screen.getByRole('button', { name: 'New' }));
  expect(screen.getByText('2')).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: 'Ingredient. A bottle, or something made in house' }));
  expect(mockPush).toHaveBeenLastCalledWith('/add-ingredient');

  await fireEvent.press(screen.getByRole('button', { name: 'New' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Drafts. Pick up where you left off' }));
  expect(mockPush).toHaveBeenLastCalledWith('/edit-mode');
});

