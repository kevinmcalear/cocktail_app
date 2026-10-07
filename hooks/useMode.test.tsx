import { renderHook } from '@testing-library/react-native';

import { useMode } from '@/hooks/useMode';
import { useAppMode } from '@/store/useAppMode';

// useBars' result, and who is signed in.
let mockBars: { data: unknown; isError: boolean } = { data: undefined, isError: false };
let mockAuth: { loading: boolean; user: { id: string } | null } = { loading: false, user: null };

jest.mock('@/hooks/useBars', () => ({ useBars: () => mockBars }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => mockAuth }));

async function mode(auth: typeof mockAuth, bars: Partial<typeof mockBars>) {
  mockAuth = auth;
  mockBars = { data: undefined, isError: false, ...bars };
  const { result, unmount } = await renderHook(() => useMode());
  await unmount();
  return result.current;
}

const signedIn = { loading: false, user: { id: 'u1' } };
const venueRow = { bar_id: 'b1', role_level: 40, bars: { id: 'b1', name: 'Little Rye' } };

beforeEach(() => useAppMode.setState({ mode: null }));

// Venue staff landed in home mode for a moment at launch (and Discover asked for location),
// because a disabled or cache-restoring query reports isLoading false.
test('stays in venue mode while auth or the venues are still loading', async () => {
  expect(await mode({ loading: true, user: null }, {})).toMatchObject({ mode: 'venue', isLoading: true });
  expect(await mode(signedIn, {})).toMatchObject({ mode: 'venue', isLoading: true });
});

test('home once we know there are no venues', async () => {
  expect(await mode(signedIn, { data: [] })).toMatchObject({ mode: 'home', isLoading: false });
  expect(await mode({ loading: false, user: null }, {})).toMatchObject({ mode: 'home', isLoading: false });
  expect(await mode(signedIn, { isError: true })).toMatchObject({ mode: 'home', isLoading: false });
});

test('venue staff start in venue mode and can pick home', async () => {
  expect(await mode(signedIn, { data: [venueRow] })).toMatchObject({ mode: 'venue', isLoading: false });
  useAppMode.setState({ mode: 'home' });
  expect(await mode(signedIn, { data: [venueRow] })).toMatchObject({ mode: 'home' });
});
