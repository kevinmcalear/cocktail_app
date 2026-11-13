import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';
import { SEARCH_TAB_HREF } from '@/hooks/useSearchFrom';
import type { HadDrink } from '@/lib/hadDrinks';

import { YouScreen } from './YouScreen';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockProfile: MyProfile | null = null;
let mockClaim: { status: 'pending'; confirm_bar: string | null; profile: { id: string; handle: string; display_name: string } } | null = null;
let mockHad: HadDrink[] = [];
let mockTaste: { taste: Record<string, number>; entries: []; baseline: null; answers: null; rankedDrinks: number } | null = null;
let mockMade: { id: string; name: string }[] = [];
let mockOffline = false;
let mockHadError: Error | null = null;
const mockRefetch = jest.fn();

jest.mock('./JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('./CreditsToCheck', () => ({ CreditsToCheckCard: () => null }));
jest.mock('@/hooks/useCreditsToCheck', () => ({ useCreditsToCheck: () => ({ data: [] }) }));
jest.mock('./YourBarCard', () => ({ ItsYou: () => null, YourBarCard: () => null }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockOffline ? false : true }) }));
jest.mock('@/hooks/useCollection', () => ({ useCollection: () => ({ data: { drinks: Array.from({ length: mockMade.length || mockHad.length ? 31 : 0 }, () => ({})) } }) }));
jest.mock('@/hooks/useKept', () => ({
  useLovedBars: () => ({ data: mockMade.length || mockHad.length ? [{ name: 'Little Rye' }, { name: 'Pale Moth' }, { name: 'Bellamy' }] : [], isLoading: false, refetch: mockRefetch }),
}));
jest.mock('@/hooks/useWantSummary', () => ({
  useWantSummary: () => (mockMade.length || mockHad.length ? { count: 2, open: 1, isLoading: false } : { count: 0, open: 0, isLoading: false }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }), useSegments: () => [] }));
jest.mock('../people/YouPeople', () => ({ YouPeople: () => null }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('@/components/nav/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: mockProfile }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useMyMadeDrinks: () => ({ data: mockMade, isLoading: false }),
  useProfilePositions: () => ({ data: [] }),
  useMyPersonClaim: () => ({ data: mockClaim }),
  useProfile: () => ({ data: { display_name: 'Cocktail Omakase' } }),
}));
jest.mock('@/hooks/useFlavor', () => ({ useMyTaste: () => ({ data: mockTaste }) }));
jest.mock('@/hooks/useRankings', () => ({ useMyHadDrinks: () => ({ data: mockHadError ? undefined : mockHad, isLoading: false, error: mockHadError, refetch: mockRefetch }) }));

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
  mockMade = [{ id: 'm1', name: 'Garden Gimlet' }];
  mockOffline = false;
  mockHadError = null;
  mockClaim = null;
});

describe('YouScreen', () => {
  test('nothing kept yet: the pencil, and the way to your first rank', async () => {
    mockMade = [];
    await renderWithProviders(<YouScreen />);
    expect(screen.getByText('No ranks yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rank a drink' }));
    expect(mockNavigate).toHaveBeenCalledWith(SEARCH_TAB_HREF);
  });

  test('no connection: your best from this phone, and what happens to a new rank', async () => {
    mockOffline = true;
    mockHad = [drink('a', 'Bolo Tie', 10)];
    await renderWithProviders(<YouScreen />);
    expect(screen.getByText('Saved on this phone · offline')).toBeTruthy();
    expect(screen.getByText('Bolo Tie')).toBeTruthy();
    expect(screen.getByText('A rank you make now is kept here and sent when you’re back.')).toBeTruthy();
  });

  test('your drinks did not load: says so, and Try again asks again', async () => {
    mockHadError = new Error('dropped');
    await renderWithProviders(<YouScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('a claim waiting: says so and opens the page, however the claim is checked', async () => {
    mockHad = [drink('a', 'Bolo Tie', 10)];
    mockClaim = { status: 'pending', confirm_bar: null, profile: { id: 'mr', handle: 'mathew.resler', display_name: 'Mathew Resler' } };
    await renderWithProviders(<YouScreen />);
    await fireEvent.press(screen.getByText('Your claim on Mathew Resler is being checked. It usually takes a day.'));
    expect(mockPush).toHaveBeenCalledWith('/p/mathew.resler');

    mockClaim = { ...mockClaim, confirm_bar: 'omakase' };
    await renderWithProviders(<YouScreen />);
    expect(screen.getByText('Your claim on Mathew Resler is with Cocktail Omakase’s Admin.')).toBeTruthy();
  });

  test('the page as drawn: line, three stats, your bars, your best, your taste and what you kept', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharing: { had: 'picked', bars: 'all', originals: 'all' }, showsDates: false, isModerated: false, tagline: null, headlinePositionId: null, showsPhoto: true, awardsMode: 'all', showsCity: true, city: 'Melbourne' };
    mockTaste = { taste: { bitter: 0.9, strong: 0.95, smoky: 0.7, sour: 0.2 }, entries: [], baseline: null, answers: null, rankedDrinks: 4 };
    mockHad = [drink('a', 'Penicillin', 6.6), drink('b', 'Bolo Tie', 10), drink('c', 'Negroni', 5, { venue: null }), drink('d', 'Gibson', 2)];
    await renderWithProviders(<YouScreen />);

    expect(screen.getByText('Melbourne · drinks mostly bitter and smoky')).toBeTruthy();
    expect(screen.getByLabelText('4 ranked')).toBeTruthy();
    expect(screen.getByLabelText('3 bars loved')).toBeTruthy();
    expect(screen.getByLabelText('1 made by you')).toBeTruthy();

    // Your best: your top three by score, and no more.
    expect(screen.getByLabelText(/^1\. Bolo Tie/)).toBeTruthy();
    expect(screen.getByLabelText(/^3\. Negroni/)).toBeTruthy();
    expect(screen.queryByText('Gibson')).toBeNull();

    await fireEvent.press(screen.getByRole('link', { name: 'Loved. Little Rye, Pale Moth and 1 more. 3' }));
    expect(mockPush).toHaveBeenLastCalledWith('/your-bars');
    await fireEvent.press(screen.getByRole('link', { name: 'Want to go. 1 of them is open now. 2' }));
    expect(mockPush).toHaveBeenLastCalledWith('/your-bars?tab=want');
    await fireEvent.press(screen.getByRole('link', { name: 'Bitter and smoky. From your 4 ranks' }));
    expect(mockPush).toHaveBeenLastCalledWith('/taste');
    await fireEvent.press(screen.getByRole('link', { name: 'Saved drinks. 31' }));
    expect(mockPush).toHaveBeenLastCalledWith('/saved');
    await fireEvent.press(screen.getByRole('link', { name: 'Drinks you’ve had. 4' }));
    expect(mockPush).toHaveBeenLastCalledWith('/your-drinks');
    await fireEvent.press(screen.getByRole('link', { name: 'Credits. 1 drink names you as its maker' }));
    expect(mockPush).toHaveBeenLastCalledWith('/your-drinks?tab=originals');
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(mockPush).toHaveBeenLastCalledWith('/settings');
  });
});
