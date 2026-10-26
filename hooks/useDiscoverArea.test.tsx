import { renderHook, waitFor } from '@testing-library/react-native';

import type { LocationAccess } from '@/lib/deviceLocation';
import { useFirstOpen } from '@/store/useFirstOpen';

import { useDiscoverArea } from './useDiscoverArea';

jest.mock('expo-router', () => ({ usePathname: () => '/discover', useLocalSearchParams: () => ({}) }));
const mockLocate = jest.fn(() => Promise.resolve({ status: 'ready', latitude: -37.8, longitude: 144.98 }));
jest.mock('@/hooks/useNearMe', () => ({ useNearMe: () => ({ state: { status: 'idle' }, locate: mockLocate }) }));
let mockAccess: LocationAccess | null = 'ask';
jest.mock('@/hooks/useLocationAccess', () => ({ useLocationAccess: () => mockAccess }));

beforeEach(() => {
  jest.clearAllMocks();
  useFirstOpen.setState({ cityPicked: false });
});

// Q2 (25 Oct first-use test): Discover never brings up the location prompt by itself; the card asks.
test('not allowed yet: no ask, and Discover shows anywhere', async () => {
  mockAccess = 'ask';
  const { result } = await renderHook(() => useDiscoverArea());
  await waitFor(() => expect(result.current.locating).toBe(false));
  expect(mockLocate).not.toHaveBeenCalled();
  expect(result.current.area).toEqual({ kind: 'anywhere' });
});

test('already allowed: finds the person without a word', async () => {
  mockAccess = 'granted';
  await renderHook(() => useDiscoverArea());
  await waitFor(() => expect(mockLocate).toHaveBeenCalledTimes(1));
});

test('picking a city keeps the location card away for good', async () => {
  mockAccess = 'blocked';
  const { result } = await renderHook(() => useDiscoverArea());
  result.current.onArea({ kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' });
  expect(useFirstOpen.getState().cityPicked).toBe(true);
  expect(mockLocate).not.toHaveBeenCalled();
});
