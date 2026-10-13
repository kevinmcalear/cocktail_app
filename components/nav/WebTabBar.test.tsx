import { act, fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useBottomSearchFocus } from '@/hooks/useBottomBar';
import { renderWithTamagui } from '@/jest.setup';
import { useSettingsStore } from '@/store/useSettingsStore';

import { WebTabBar } from './WebTabBar';

jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'home' }) }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));
jest.mock('./CreateSheet', () => {
  const { Text } = jest.requireActual('react-native');
  return { CreateSheet: () => <Text>New sheet</Text> };
});

const names = ['discover', 'bar', 'collection', 'profile', 'search'];
const props = {
  state: { index: 0, routes: names.map((name) => ({ key: name, name })) },
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab: jest.fn(),
} as unknown as BottomTabBarProps;

afterEach(() => {
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
