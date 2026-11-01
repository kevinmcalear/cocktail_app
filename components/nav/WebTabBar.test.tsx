import { act, fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { renderWithTamagui } from '@/jest.setup';

import { WebTabBar } from './WebTabBar';

let mockMode = 'home';
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
let mockHidden: string[] = [];
jest.mock('@/hooks/useFirstRound', () => ({ useFirstRound: () => ({ hidden: mockHidden }) }));
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
  mockHidden = [];
  useBottomSearchFocus.setState({ focused: false });
});

test('at home: Discover, My Bar, Collection and New; You opens from the avatar, not a tab', async () => {
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Discover', 'My Bar', 'Collection']);
  expect(screen.queryByRole('tab', { name: 'You' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^New:/ }));
  expect(screen.getByText('New sheet')).toBeTruthy();
});

test('while the bottom search field has focus, the bar steps aside for it', async () => {
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy();
  await act(async () => useBottomSearchFocus.setState({ focused: true }));
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});

test('at a venue: New takes a tab’s room, so the bar stays at five with Search', async () => {
  mockMode = 'venue';
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Tonight', 'Library', 'Discover']);
  expect(screen.getByRole('button', { name: /^New:/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
});

test('the first round holds Menus and Discover back until their steps come up', async () => {
  mockMode = 'venue';
  mockHidden = ['menus', 'discover'];
  await renderWithTamagui(<WebTabBar {...props} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Tonight', 'Library']);
  expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
});
