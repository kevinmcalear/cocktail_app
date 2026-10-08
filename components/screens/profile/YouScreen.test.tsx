import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MyProfile } from '@/hooks/useMyProfile';
import type { HadDrink } from '@/lib/hadDrinks';

import { YouScreen } from './YouScreen';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockProfile: MyProfile | null = null;
let mockHad: HadDrink[] = [];
let mockTaste: { taste: Record<string, number>; entries: []; baseline: null; answers: null; rankedDrinks: number } | null = null;

jest.mock('./JobRequests', () => ({ JobRequests: () => null, MyJobRequests: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: { full_name: 'Jo Juniper' } }, loading: false }) }));
jest.mock('@/components/nav/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: mockProfile }) }));
jest.mock('@/hooks/useProfiles', () => ({ useMyMadeDrinks: () => ({ data: [{ id: 'm1', name: 'Garden Gimlet' }], isLoading: false }) }));
jest.mock('@/hooks/useFlavor', () => ({ useMyTaste: () => ({ data: mockTaste }), useItemFlavors: () => ({ data: {} }) }));
jest.mock('@/hooks/useRankings', () => ({ useMyHadDrinks: () => ({ data: mockHad, isLoading: false, error: null }) }));

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
    expect(screen.getByLabelText('0 drinks had')).toBeTruthy();
    expect(screen.queryByText('Favourites')).toBeNull();
    expect(screen.getByText(/Open a drink you’ve had and tap Rank it/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Find a drink' }));
    expect(mockNavigate).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByRole('button', { name: 'Make a public profile' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/profile');
  });

  test('shows every drink with its score, favourites, each bar’s average, and what you made', async () => {
    mockProfile = { id: 'p1', handle: 'jo.home', displayName: 'Jo', bio: null, instagram: null, isPublic: true, sharesRankings: false, sharesBars: false, sharesMade: true, isModerated: false };
    mockHad = [
      drink('a', 'Bolo Tie', 10),
      drink('b', 'Penicillin', 6.6),
      drink('c', 'Negroni', 5, { venue: null, hadOn: null }),
    ];
    await renderWithTamagui(<YouScreen />);
    expect(screen.getByText('@jo.home · Public profile')).toBeTruthy();
    expect(screen.getByLabelText('3 drinks had')).toBeTruthy();
    expect(screen.getByLabelText('1 bar')).toBeTruthy();
    expect(screen.getByLabelText('1 made')).toBeTruthy();

    // Favourites: only the one they loved.
    expect(screen.getByText('Favourites')).toBeTruthy();
    expect(screen.getByLabelText('Bolo Tie, Little Rye, Fitzroy. Score 10.0')).toBeTruthy();
    expect(screen.queryByLabelText(/^Penicillin, Little Rye/)).toBeNull();

    // Had: every drink, best first, each opening the drink.
    const penicillin = screen.getByLabelText(/^Penicillin\. Little Rye, Fitzroy · Sep 2026\. Score 6\.6, open$/);
    expect(screen.getByLabelText('Negroni. At home. Score 5.0, open')).toBeTruthy();
    await fireEvent.press(penicillin);
    expect(mockPush).toHaveBeenCalledWith('/cocktail/item-b');

    await fireEvent.press(screen.getByRole('tab', { name: 'Bars' }));
    expect(screen.getByLabelText('Number 1: Little Rye, 2 drinks · best: Bolo Tie. Score 8.3, average')).toBeTruthy();
    expect(screen.getByLabelText('Number 2: At home, 1 drink · best: Negroni. Score 5.0')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Made' }));
    expect(screen.getByText('Garden Gimlet')).toBeTruthy();
  });
});
