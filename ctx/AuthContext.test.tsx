import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/ctx/AuthContext';
import { useUserCacheSync } from '@/hooks/useUserCacheSync';

type Listener = (event: string, session: unknown) => void;

// auth-js stand-in: getSession() answers when the test says (as it does after
// refreshing an expired token), and the saved session is read when the test
// says at launch, straight away after that.
let resolveGetSession: (session: unknown, error?: Error) => void = () => {};
let listener: Listener = () => {};
let mockStoredUser: { id: string } | null = null;
let resolveStored: (() => void) | null = null;
let mockStoredReads = 0;
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
const mockClear = jest.fn(() => Promise.resolve());

jest.mock('@/lib/supabase', () => ({
  readStoredUser: () =>
    mockStoredReads++ === 0
      ? new Promise((resolve) => {
          resolveStored = () => resolve(mockStoredUser);
        })
      : Promise.resolve(mockStoredUser),
  forgetStoredSession: async () => {
    mockStoredUser = null;
  },
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: () => mockSignOut(),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
jest.mock('@/lib/analytics', () => ({ track: () => {} }));
jest.mock('@/lib/authRedirect', () => ({ getAuthRedirectTo: () => '' }));
jest.mock('@/lib/clearUserData', () => ({ clearUserData: () => mockClear() }));
jest.mock('@/lib/react-query', () => ({
  queryClient: { resetQueries: () => Promise.resolve(), getMutationCache: () => ({ getAll: () => [], remove: () => {} }) },
}));

beforeEach(() => {
  mockStoredReads = 0;
  mockClear.mockClear();
  mockSignOut.mockReset();
  mockGetSession.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveGetSession = (session, error) => resolve({ data: { session }, error: error ?? null });
      }),
  );
  onlineManager.setOnline(true);
});

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const sessionOf = (id: string) => ({ access_token: 'new', user: { id } });

async function launch(storedUser: { id: string } | null) {
  mockStoredUser = storedUser;
  // With the cache sync the app runs, to see what gets forgotten.
  const hook = await renderHook(
    () => {
      useUserCacheSync();
      return useAuth();
    },
    { wrapper },
  );
  return hook;
}

// What auth-js answers when /token can't be reached (checked against the
// local stack): null, a retryable error, and the saved session kept.
const unreachable = () => new AuthRetryableFetchError('Network request failed', 0);

const pick = ({ user, session, loading }: ReturnType<typeof useAuth>) => ({
  user: user?.id ?? null,
  session: (session?.user.id as string | undefined) ?? null,
  loading,
});

test('while auth-js refreshes, the saved session gives the user but no session', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: true });
  await act(async () => resolveStored?.());
  expect(pick(result.current)).toEqual({ user: 'u1', session: null, loading: true });

  await act(async () => resolveGetSession(sessionOf('u1')));
  expect(pick(result.current)).toEqual({ user: 'u1', session: 'u1', loading: false });
  await unmount();
});

test('a refresh that fails drops the saved user, as a sign-out', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  // auth-js removes a session it can't refresh and announces SIGNED_OUT.
  await act(async () => listener('SIGNED_OUT', null));
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  await act(async () => resolveGetSession(null));
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  await unmount();
});

test('the refresh announcing itself settles auth before getSession answers', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => listener('TOKEN_REFRESHED', sessionOf('u1')));
  expect(pick(result.current)).toEqual({ user: 'u1', session: 'u1', loading: false });
  await unmount();
});

test('a saved session read after auth settled is ignored', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveGetSession(null));
  await act(async () => resolveStored?.());
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  await unmount();
});

test('settling on a different user replaces the saved one', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => listener('SIGNED_IN', sessionOf('u2')));
  expect(pick(result.current)).toEqual({ user: 'u2', session: 'u2', loading: false });
  await unmount();
});

test('nothing saved: no user until auth settles', async () => {
  const { result, unmount } = await launch(null);
  await act(async () => resolveStored?.());
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: true });
  await act(async () => resolveGetSession(null));
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  await unmount();
});

test('launched offline with an expired token: the saved user stays, nothing is forgotten', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => listener('INITIAL_SESSION', null));
  await act(async () => resolveGetSession(null, unreachable()));
  expect(pick(result.current)).toEqual({ user: 'u1', session: null, loading: true });
  expect(mockClear).not.toHaveBeenCalled();

  // Back online: auth-js is asked again, refreshes, and auth settles as the same user.
  await act(async () => onlineManager.setOnline(false));
  expect(mockGetSession).toHaveBeenCalledTimes(1);
  await act(async () => onlineManager.setOnline(true));
  expect(mockGetSession).toHaveBeenCalledTimes(2);
  await act(async () => listener('TOKEN_REFRESHED', sessionOf('u1')));
  await act(async () => resolveGetSession(sessionOf('u1')));
  expect(pick(result.current)).toEqual({ user: 'u1', session: 'u1', loading: false });
  expect(mockClear).not.toHaveBeenCalled();
  await unmount();
});

test('still unreachable after coming back online: keeps waiting, then auth-js ticker gets through', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => resolveGetSession(null, unreachable()));
  await act(async () => onlineManager.setOnline(false));
  await act(async () => onlineManager.setOnline(true));
  await act(async () => resolveGetSession(null, unreachable()));
  expect(pick(result.current)).toEqual({ user: 'u1', session: null, loading: true });

  await act(async () => listener('TOKEN_REFRESHED', sessionOf('u1')));
  expect(pick(result.current)).toEqual({ user: 'u1', session: 'u1', loading: false });
  expect(mockClear).not.toHaveBeenCalled();
  await unmount();
});

test('the refresh rejected (400) at launch: signed out and forgotten, as before', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  // auth-js deletes the saved session, announces SIGNED_OUT, then answers null.
  mockStoredUser = null;
  await act(async () => listener('SIGNED_OUT', null));
  await act(async () => resolveGetSession(null));
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  expect(mockClear).toHaveBeenCalledTimes(1);
  await unmount();
});

test('the refresh rejected once back online: signed out and forgotten', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => resolveGetSession(null, unreachable()));
  await act(async () => onlineManager.setOnline(false));
  await act(async () => onlineManager.setOnline(true));
  mockStoredUser = null;
  await act(async () => listener('SIGNED_OUT', null));
  await act(async () => resolveGetSession(null, new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found')));
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  expect(mockClear).toHaveBeenCalledTimes(1);
  await unmount();
});

test('signing out while offline forgets the saved session without the server', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => resolveGetSession(null, unreachable()));
  await act(async () => result.current.signOut());
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(mockStoredUser).toBeNull();
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  expect(mockClear).toHaveBeenCalledTimes(1);
  await unmount();
});

test("signing out when auth-js can't reach the server still signs out", async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveGetSession(sessionOf('u1')));
  mockSignOut.mockResolvedValue({ error: unreachable() });
  await act(async () => result.current.signOut());
  expect(mockStoredUser).toBeNull();
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });
  expect(mockClear).toHaveBeenCalledTimes(1);
  await unmount();
});

test('a refresh that gets through after an offline sign-out is forgotten, not signed back in', async () => {
  const { result, unmount } = await launch({ id: 'u1' });
  await act(async () => resolveStored?.());
  await act(async () => result.current.signOut());
  // auth-js's refresh, started before the sign-out, lands and saves the session again.
  mockStoredUser = { id: 'u1' };
  await act(async () => listener('TOKEN_REFRESHED', sessionOf('u1')));
  expect(mockStoredUser).toBeNull();
  expect(pick(result.current)).toEqual({ user: null, session: null, loading: false });

  // Signing in again works as usual.
  await act(async () => listener('SIGNED_IN', sessionOf('u2')));
  await act(async () => listener('TOKEN_REFRESHED', sessionOf('u2')));
  expect(pick(result.current)).toEqual({ user: 'u2', session: 'u2', loading: false });
  await unmount();
});
