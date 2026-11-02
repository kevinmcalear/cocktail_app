import { act, fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { renderWithProviders } from '@/jest.setup';

import { WebTabBar } from './WebTabBar';

jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
const mockOpenSearch = jest.fn();
jest.mock('@/hooks/useSearchFrom', () => ({ useOpenSearch: () => mockOpenSearch }));

const names = ['(1-tonight)', '(2-drinks)', '(3-discover)', '(4-you)'];
const navigateToTab = jest.fn();
const props = {
  state: { index: 0, routes: names.map((name) => ({ key: name, name })) },
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab,
} as unknown as BottomTabBarProps;

afterEach(() => {
  navigateToTab.mockClear();
  useBottomSearchFocus.setState({ focused: false });
});

test('the four tabs and the search circle, the same for everyone', async () => {
  await renderWithProviders(<WebTabBar {...props} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Tonight', 'Drinks', 'Discover', 'You']);
  expect(screen.getByRole('tab', { name: 'Tonight', selected: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^New/ })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Drinks' }));
  expect(navigateToTab).toHaveBeenLastCalledWith('(2-drinks)');
  await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
  expect(mockOpenSearch).toHaveBeenCalled();
});

test('while the bottom search field has focus, the bar steps aside for it', async () => {
  await renderWithProviders(<WebTabBar {...props} />);
  expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy();
  await act(async () => useBottomSearchFocus.setState({ focused: true }));
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});
