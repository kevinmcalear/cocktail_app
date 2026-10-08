import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/ctx/AuthContext';

type Listener = (event: string, session: unknown) => void;

// auth-js stand-in: getSession() answers when the test says (as it does after
// refreshing an expired token), and the saved session is read straight away.
let resolveGetSession: (session: unknown) => void = () => {};
let listener: Listener = () => {};
let mockStoredUser: { id: string } | null = null;
let resolveStored: (() => void) | null = null;

jest.mock('@/lib/supabase', () => ({
  readStoredUser: () =>
    new Promise((resolve) => {
      resolveStored = () => resolve(mockStoredUser);
    }),
  supabase: {
    auth: {
      getSession: () =>
        new Promise((resolve) => {
          resolveGetSession = (session) => resolve({ data: { session } });
        }),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));
jest.mock('@/lib/analytics', () => ({ track: () => {} }));
jest.mock('@/lib/authRedirect', () => ({ getAuthRedirectTo: () => '' }));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const sessionOf = (id: string) => ({ access_token: 'new', user: { id } });

async function launch(storedUser: { id: string } | null) {
  mockStoredUser = storedUser;
  const hook = await renderHook(() => useAuth(), { wrapper });
  return hook;
}

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
