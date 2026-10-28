import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';
import type { HadDrink } from '@/lib/hadDrinks';

import { YouScreen } from './YouScreen';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockProfile: MyProfile | null = null;
let mockClaim: { status: 'pending'; confirm_bar: string | null; profile: { id: string; handle: string; display_name: string } } | null = null;
let mockHad: HadDrink[] = [];
let mockTaste: { taste: Record<string, number>; entries: []; baseline: null; answers: null; rankedDrinks: number } | null = null;

jest.mock('./JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('./CreditsToCheck', () => ({ CreditsToCheckCard: () => null }));
jest.mock('@/hooks/useCreditsToCheck', () => ({ useCreditsToCheck: () => ({ data: [] }) }));
jest.mock('./YourBarCard', () => ({ ItsYou: () => null, YourBarCard: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('@/components/nav/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: mockProfile }) }));
const mockSetHad = jest.fn();
let mockPicks: Record<string, { onProfile: boolean | null; pin: number | null; saysWhere: boolean }> = {};
jest.mock('./PersonAwards', () => ({ MyAwards: () => null }));
jest.mock('./useShareLink', () => ({ useShareLink: () => jest.fn() }));
jest.mock('@/hooks/useProfiles', () => ({
  useMyMadeDrinks: () => ({ data: [{ id: 'm1', name: 'Garden Gimlet', origin_year: 2025, item_images: [], glass: null }], isLoading: false }),
  useProfilePositions: () => ({ data: [] }),
  useMyPersonClaim: () => ({ data: mockClaim }),
  useProfile: () => ({ data: { display_name: 'Cocktail Omakase' } }),
  useProfilePicks: () => ({ data: {} }),
  useSetPick: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('@/hooks/useFlavor', () => ({ useMyTaste: () => ({ data: mockTaste }), useItemFlavors: () => ({ data: {} }), useItemScores: () => ({ data: {} }) }));
jest.mock('@/hooks/useRankings', () => ({
  useMyHadDrinks: () => ({ data: mockHad, isLoading: false, error: null }),
  useMyHadPicks: () => ({ data: mockPicks }),
  useSetHadPick: () => ({ mutate: mockSetHad, isPending: false, error: null }),
}));
jest.mock('@/hooks/useSpecMatches', () => ({ useSpecMatches: () => ({ data: undefined }) }));

const rye = { id: 'v1', handle: 'little.rye', name: 'Little Rye', avatarUrl: null, place: 'Fitzroy, Melbourne' };
const drink = (id: string, name: string, score: number, over: Partial<HadDrink> = {}): HadDrink => ({
  id,
  itemId: `item-${id}`,
  name,
  listName: null,
  imageUrl: null,
  isSketch: false,
  venue: rye,
  sentiment: score >= 6.7 ? 'loved' : 'fine',
  score,
  hadOn: '2026-09-12',
  createdAt: '2026-09-12T10:00:00Z',
  ...over,
});

beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockProfile = null;
  mockHad = [];
  mockTaste = null;
  mockPicks = {};
  mockSetHad.mockClear();
});

describe('YouScreen', () => {
  test('your taste in a line, with the way to change it', async () => {
    mockTaste = { taste: {}, entries: [], baseline: null, answers: null, rankedDrinks: 0 };
    await renderWithTamagui(<YouScreen />);
    await fireEvent.press(screen.getByRole('link', { name: /^Your taste\. Not set yet\. Tell us what you like/ }));
    expect(mockPush).toHaveBeenCalledWith('/taste');

    mockTaste = { taste: { bitter: 0.9, strong: 0.95, smoky: 0.7, sour: 0.2 }, entries: [], baseline: null, answers: null, rankedDrinks: 3 };
    await renderWithTamagui(<YouScreen />);
    expect(screen.getByText('Bitter and smoky.')).toBeTruthy();
    expect(screen.getByText("From the 3 drinks you've ranked.")).toBeTruthy();
  });

  test('nothing ranked yet: says how to start, and offers a public profile', async () => {
    await renderWithTamagui(<YouScreen />);
    expect(screen.getByText('Jo Juniper')).toBeTruthy();
    expect(screen.getByText('No public profile yet')).toBeTruthy();
    expect(screen.getByLabelText('0 drinks')).toBeTruthy();
    expect(screen.queryByText('Top four')).toBeNull();
    expect(screen.getByText(/Open a drink you’ve had and tap Rank it/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Find a drink' }));
    expect(mockNavigate).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByRole('button', { name: 'Make a public profile' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/profile');
  });

  test('a claim waiting on a page: says so, and offers the page, not a second profile', async () => {
    mockClaim = { status: 'pending', confirm_bar: null, profile: { id: 'mr', handle: 'mathew.resler', display_name: 'Mathew Resler' } };
    try {
      await renderWithTamagui(<YouScreen />);
      expect(screen.getByText('Claim sent for Mathew Resler · A person checks it, usually within a day')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Make a public profile' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'See the page' }));
      expect(mockPush).toHaveBeenCalledWith('/p/mathew.resler');

      mockClaim = { ...mockClaim, confirm_bar: 'omakase' };
      await renderWithTamagui(<YouScreen />);
      expect(screen.getByText('Claim sent for Mathew Resler · Cocktail Omakase’s Admin confirms it')).toBeTruthy();
    } finally {
      mockClaim = null;
    }
  });

  test('its own preview: city and line, top four from your pins, an eye on every row', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharing: { had: 'picked', bars: 'all', originals: 'all' }, showsDates: false, isModerated: false, tagline: 'Home bartender', headlinePositionId: null, showsPhoto: true, awardsMode: 'all', showsCity: true, city: 'Melbourne' };
    mockHad = [drink('a', 'Bolo Tie', 10), drink('b', 'Penicillin', 6.6), drink('c', 'Negroni', 5, { venue: null, hadOn: null })];
    mockPicks = { a: { onProfile: true, pin: 1, saysWhere: true } };
    await renderWithTamagui(<YouScreen />);
    expect(screen.getByText('@jo.home · Melbourne · Public profile')).toBeTruthy();
    expect(screen.getByText('Home bartender')).toBeTruthy();
    expect(screen.getByLabelText('3 drinks')).toBeTruthy();
    expect(screen.getByLabelText('1 bar')).toBeTruthy();
    expect(screen.getByLabelText('1 original')).toBeTruthy();

    // Top four: the pin, then three empty places.
    expect(screen.getByLabelText('1. Bolo Tie, score 10.0')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Place \d, empty$/)).toHaveLength(3);

    // Picked: one of three shows; the others are greyed with Only you.
    expect(screen.getByText('Picked · 1 of 3 shown')).toBeTruthy();
    expect(screen.getAllByText('Only you')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Show Penicillin on your profile' }));
    expect(mockSetHad).toHaveBeenCalledWith({ id: 'b', onProfile: true, pin: null });
    await fireEvent.press(screen.getByRole('link', { name: /^Penicillin\. Little Rye/ }));
    expect(mockPush).toHaveBeenCalledWith('/cocktail/item-b');

    await fireEvent.press(screen.getByRole('tab', { name: 'Bars' }));
    expect(screen.getByText('All · 1 of 1 shown')).toBeTruthy();
    expect(screen.getByText('2 drinks · Fitzroy')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Originals' }));
    expect(screen.getByText('Garden Gimlet')).toBeTruthy();
    expect(screen.getByText('Your original · 2025')).toBeTruthy();
  });
});
