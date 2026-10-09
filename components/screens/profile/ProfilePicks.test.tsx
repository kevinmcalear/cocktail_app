import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';
import type { HadDrink } from '@/lib/hadDrinks';

import { ProfilePicksScreen } from './ProfilePicks';

const mockSetHad = jest.fn();
const mockSetPick = jest.fn();
const mockSaveSharing = jest.fn();
let mockProfile: MyProfile;
let mockHadPicks: Record<string, { onProfile: boolean | null; pin: number | null }> = {};

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
}));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePicks: () => ({ data: { rye: false } }),
  useProfileOriginals: () => ({ data: [] }),
  useSetPick: () => ({ mutate: mockSetPick, error: null }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHadPicks = {};
  mockProfile = {
    id: 'p1', handle: 'jo', displayName: 'Jo', bio: null, instagram: null, isPublic: true, isModerated: false,
    sharing: { had: 'picked', bars: 'all', originals: 'all' }, showsDates: false, tagline: null, headlinePositionId: null, showsPhoto: true,
  };
});

test('Picked: only the drinks you switch on show; switching one on saves it', async () => {
  mockHadPicks = { a: { onProfile: true, pin: null } };
  await renderWithTamagui(<ProfilePicksScreen section="had" />);
  expect(screen.getByRole('switch', { name: 'Show Martini on my profile' }).props.value).toBe(true);
  expect(screen.getByRole('switch', { name: 'Show Negroni on my profile' }).props.value).toBe(false);
  await fireEvent(screen.getByRole('switch', { name: 'Show Negroni on my profile' }), 'valueChange', true);
  expect(mockSetHad).toHaveBeenCalledWith({ id: 'b', onProfile: true, pin: null });
});

test('pinning takes the first free place in the top four', async () => {
  mockHadPicks = { a: { onProfile: true, pin: 1 }, b: { onProfile: true, pin: 3 }, c: { onProfile: true, pin: null } };
  await renderWithTamagui(<ProfilePicksScreen section="had" />);
  expect(screen.getByText(/Top four, number 1/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pin Long Island to your top four' }));
  expect(mockSetHad).toHaveBeenCalledWith({ id: 'c', onProfile: true, pin: 2 });
});

test('All: every bar shows except one you hid', async () => {
  await renderWithTamagui(<ProfilePicksScreen section="bars" />);
  expect(screen.getByRole('switch', { name: 'Show Little Rye on my profile' }).props.value).toBe(false);
  await fireEvent(screen.getByRole('switch', { name: 'Show Little Rye on my profile' }), 'valueChange', true);
  expect(mockSetPick).toHaveBeenCalledWith({ profileId: 'p1', section: 'bars', targetId: 'rye', shown: true });
});
