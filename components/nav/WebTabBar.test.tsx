import { act, fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { renderWithTamagui } from '@/jest.setup';
import { useSettingsStore } from '@/store/useSettingsStore';

import { WebTabBar } from './WebTabBar';

let mockMode = 'home';
let mockFeatures: string[] = [];
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
jest.mock('@/hooks/useVenueFeatures', () => ({ useVenueFeatures: () => ({ ready: true, has: (k: string) => mockFeatures.includes(k) }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
jest.mock('./CreateSheet', () => {
  const { Text } = jest.requireActual('react-native');
  return { CreateSheet: () => <Text>New sheet</Text> };
});

const names = ['index', 'library', 'menus', 'prep', 'test', 'discover', 'bar', 'collection', 'profile', 'search'];
const props = {
  state: { index: 0, routes: names.map((name) => ({ key: name, name })) },
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab: jest.fn(),
} as unknown as BottomTabBarProps;

afterEach(() => {
  mockMode = 'home';
  mockFeatures = [];
  useSettingsStore.setState({ bottomBar: false });
  useBottomSearchFocus.setState({ focused: false });
});

test('off: the tabs as they are, You included, no New', async () => {
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getByRole('tab', { name: 'You' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^New:/ })).toBeNull();
});

test('Try it: New joins the tabs in place of You and opens the New sheet', async () => {
  useSettingsStore.setState({ bottomBar: true });
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.queryByRole('tab', { name: 'You' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^New:/ }));
  expect(screen.getByText('New sheet')).toBeTruthy();
});

test('Try it: while the bottom search field has focus, the bar steps aside for it', async () => {
  useSettingsStore.setState({ bottomBar: true });
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy();
  await act(async () => useBottomSearchFocus.setState({ focused: true }));
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});

test('Try it at a venue with every tab on: New takes a tab’s room, so the bar stays at five with Search', async () => {
  mockMode = 'venue';
  mockFeatures = ['tonight', 'prep', 'study'];
  useSettingsStore.setState({ bottomBar: true });
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Tonight', 'Library', 'Discover']);
  expect(screen.getByRole('button', { name: /^New:/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
});
