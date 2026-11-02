import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { LocationAccess } from '@/lib/deviceLocation';

import { useDiscoverArea } from './useDiscoverArea';

jest.mock('expo-router', () => ({ usePathname: () => '/discover', useLocalSearchParams: () => ({}) }));
const mockLocate = jest.fn(() => Promise.resolve({ status: 'ready', latitude: -37.8, longitude: 144.98 }));
let mockNear: { status: string } = { status: 'idle' };
jest.mock('@/hooks/useNearMe', () => ({ useNearMe: () => ({ state: mockNear, locate: mockLocate }) }));
let mockAccess: LocationAccess | null = 'ask';
jest.mock('@/hooks/useLocationAccess', () => ({ useLocationAccess: () => mockAccess }));

beforeEach(() => {
  jest.clearAllMocks();
});

// Q2 (25 Oct first-use test): Discover never brings up the location prompt by itself; Near me asks.
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

test('Near me says when location is off, until a city is picked', async () => {
  mockAccess = 'blocked';
  mockNear = { status: 'denied' };
  const { result, rerender } = await renderHook(() => useDiscoverArea());
  expect(result.current.note).toMatch(/Location is off/);
  await act(async () => result.current.onArea({ kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' }));
  await rerender({});
  expect(result.current.note).toBeNull();
  expect(mockLocate).not.toHaveBeenCalled();
  mockNear = { status: 'idle' };
});
