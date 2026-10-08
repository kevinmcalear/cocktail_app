import { renderHook } from '@testing-library/react-native';

import { useMode } from '@/hooks/useMode';
import { useAppMode } from '@/store/useAppMode';

// useBars' result, and who is signed in.
let mockBars: { data: unknown; isError: boolean } = { data: undefined, isError: false };
let mockAuth: { loading: boolean; user: { id: string } | null } = { loading: false, user: null };

jest.mock('@/hooks/useBars', () => ({ useBars: () => mockBars }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => mockAuth));

async function mode(auth: typeof mockAuth, bars: Partial<typeof mockBars>) {
  mockAuth = auth;
  mockBars = { data: undefined, isError: false, ...bars };
  const { result, unmount } = await renderHook(() => useMode());
  await unmount();
  return result.current;
}

const signedIn = { loading: false, user: { id: 'u1' } };
const venueRow = { bar_id: 'b1', role_level: 40, bars: { id: 'b1', name: 'Little Rye' } };

beforeEach(() => {
  jest.restoreAllMocks();
  useAppMode.setState({ mode: null, known: null });
});

// Venue staff landed in home mode for a moment at launch (and Discover asked for location),
// because a disabled or cache-restoring query reports isLoading false.
test('while auth or the venues load, it keeps the mode this device last settled on', async () => {
  useAppMode.setState({ known: 'venue' });
  expect(await mode({ loading: true, user: null }, {})).toMatchObject({ mode: 'venue', isLoading: true, ready: true });
  useAppMode.setState({ known: 'home' });
  expect(await mode(signedIn, {})).toMatchObject({ mode: 'home', isLoading: true, ready: true });
});

// Home bartenders used to get venue tabs (Tonight, Library and their fetches) until their venues loaded.
test("isn't ready on a first launch until it knows, or before storage is read", async () => {
  expect(await mode(signedIn, {})).toMatchObject({ isLoading: true, ready: false });
  useAppMode.setState({ known: 'home' });
  jest.spyOn(useAppMode.persist, 'hasHydrated').mockReturnValue(false);
  expect(await mode(signedIn, {})).toMatchObject({ isLoading: true, ready: false });
});

test('remembers where it settled for the next launch', async () => {
  await mode(signedIn, { data: [] });
  expect(useAppMode.getState().known).toBe('home');
  await mode(signedIn, { data: [venueRow] });
  expect(useAppMode.getState().known).toBe('venue');
  useAppMode.getState().setMode('home');
  expect(useAppMode.getState().known).toBe('home');
});

test('home once we know there are no venues', async () => {
  expect(await mode(signedIn, { data: [] })).toMatchObject({ mode: 'home', isLoading: false, ready: true });
  expect(await mode({ loading: false, user: null }, {})).toMatchObject({ mode: 'home', isLoading: false });
  expect(await mode(signedIn, { isError: true })).toMatchObject({ mode: 'home', isLoading: false });
});

test('venue staff start in venue mode and can pick home', async () => {
  expect(await mode(signedIn, { data: [venueRow] })).toMatchObject({ mode: 'venue', isLoading: false });
  useAppMode.setState({ mode: 'home' });
  expect(await mode(signedIn, { data: [venueRow] })).toMatchObject({ mode: 'home' });
});
