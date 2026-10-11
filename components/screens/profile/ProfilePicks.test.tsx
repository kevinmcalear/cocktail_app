import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';
import type { HadDrink } from '@/lib/hadDrinks';

import { ProfilePicksScreen } from './ProfilePicks';

const mockSetHad = jest.fn();
const mockSetPick = jest.fn();
const mockSaveSharing = jest.fn();
let mockProfile: MyProfile;
const mockPin = jest.fn();
const mockAll = jest.fn();
let mockHadPicks: Record<string, { onProfile: boolean | null; pin: number | null; saysWhere: boolean }> = {};

const drink = (id: string, name: string, score: number, venue: HadDrink['venue'] = null): HadDrink => ({
  id, itemId: `i-${id}`, name, listName: null, imageUrl: null, isSketch: false, venue, sentiment: 'loved', score, hadOn: null, createdAt: '2026-09-01T10:00:00Z',
});
const rye = { id: 'rye', handle: 'little.rye', name: 'Little Rye', avatarUrl: null, place: null };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ data: mockProfile, isPending: false }),
  useSaveSharing: () => ({ mutate: mockSaveSharing, isPending: false }),
}));
jest.mock('@/hooks/useRankings', () => ({
  useMyHadDrinks: () => ({ data: [drink('a', 'Martini', 9.6, rye), drink('b', 'Negroni', 8.4), drink('c', 'Long Island', 4.1, rye)] }),
  useMyHadPicks: () => ({ data: mockHadPicks }),
  useSetHadPick: () => ({ mutate: mockSetHad, error: null }),
  usePinDrink: () => ({ mutate: mockPin, error: null, isPending: false }),
  useSetAllHadPicks: () => ({ mutate: mockAll, error: null, isPending: false }),
}));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePicks: () => ({ data: { rye: false } }),
  useMyMadeDrinks: () => ({ data: [] }),
  useSetPick: () => ({ mutate: mockSetPick, error: null }),
  useSetPicks: () => ({ mutate: jest.fn(), error: null, isPending: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHadPicks = {};
  mockProfile = {
    id: 'p1', handle: 'jo', displayName: 'Jo', bio: null, instagram: null, isPublic: true, isModerated: false,
    sharing: { had: 'picked', bars: 'all', originals: 'all' }, showsDates: false, tagline: null, headlinePositionId: null, showsPhoto: true, awardsMode: 'all', showsCity: true, city: null,
  };
});

const pick = (onProfile: boolean | null, pin: number | null = null) => ({ onProfile, pin, saysWhere: true });

test('Picked: only the drinks you switch on show, with the count; switching one on saves it', async () => {
  mockHadPicks = { a: pick(true) };
  await renderWithTamagui(<ProfilePicksScreen section="had" />);
  expect(screen.getByText('1 of 3 shown')).toBeTruthy();
  expect(screen.getByText(/set to Picked: only the ones you switch on show/)).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'None' })).toBeNull();
  expect(screen.getByRole('switch', { name: 'Show Martini on your profile' }).props.value).toBe(true);
  await fireEvent(screen.getByRole('switch', { name: 'Show Negroni on your profile' }), 'valueChange', true);
  expect(mockSetHad).toHaveBeenCalledWith({ id: 'b', onProfile: true, pin: null });
});

test('the filter shows only the hidden ones, and Hide all hides every drink', async () => {
  mockHadPicks = { a: pick(true) };
  await renderWithTamagui(<ProfilePicksScreen section="had" />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Hidden' }));
  expect(screen.queryByRole('switch', { name: 'Show Martini on your profile' })).toBeNull();
  expect(screen.getByRole('switch', { name: 'Show Negroni on your profile' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Hide all' }));
  expect(mockAll).toHaveBeenCalledWith(false);
});

test('a fifth pin makes room by taking the oldest, and says so', async () => {
  mockHadPicks = { a: pick(true, 1), b: pick(true, 2), c: pick(true) };
  mockPin.mockImplementation((_v, opts) => opts.onSuccess('a'));
  await renderWithTamagui(<ProfilePicksScreen section="had" />);
  expect(screen.getByText(/Four fit\. Pin a fifth/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pin Long Island to your top four' }));
  expect(mockPin).toHaveBeenCalledWith({ id: 'c', pin: true }, expect.anything());
  expect(screen.getByText('Martini made room for Long Island.')).toBeTruthy();
});

test('All: every bar shows except one you hid', async () => {
  await renderWithTamagui(<ProfilePicksScreen section="bars" />);
  expect(screen.getByRole('switch', { name: 'Show Little Rye on your profile' }).props.value).toBe(false);
  await fireEvent(screen.getByRole('switch', { name: 'Show Little Rye on your profile' }), 'valueChange', true);
  expect(mockSetPick).toHaveBeenCalledWith({ profileId: 'p1', section: 'bars', targetId: 'rye', shown: true });
});
