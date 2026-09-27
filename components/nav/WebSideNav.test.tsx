import { fireEvent, screen } from '@testing-library/react-native';

import { WebSideNav } from '@/components/nav/WebSideNav';
import { renderWithTamagui } from '@/jest.setup';

const mockNavigate = jest.fn();
let mockPathname = '/';
let mockMode: 'venue' | 'home' = 'venue';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
// These read the signed-in person's venues from Supabase; the nav doesn't need them here.
jest.mock('@/components/nav/VenueBrandProvider', () => ({ VenueBrandProvider: ({ children }: { children: unknown }) => children }));
jest.mock('@/components/nav/VenueSwitcher', () => ({ VenueSwitcher: () => null }));
jest.mock('@/components/WebSidebar', () => ({ WEB_SIDEBAR_WIDTH: 240 }));

const links = () => screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);

beforeEach(() => mockNavigate.mockClear());

test('venue mode lists search and the venue tabs, marking the current one', async () => {
  mockMode = 'venue';
  mockPathname = '/library';
  await renderWithTamagui(<WebSideNav />);

  expect(links()).toEqual(['Search', 'Tonight', 'Library', 'Prep', 'Study', 'Menus', 'Back bar']);
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
