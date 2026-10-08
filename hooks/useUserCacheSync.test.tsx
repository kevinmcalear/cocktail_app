import { renderHook } from '@testing-library/react-native';

import { useUserCacheSync } from '@/hooks/useUserCacheSync';

type Auth = { loading: boolean; user: { id: string } | null; session: { user: { id: string } } | null };

let mockAuth: Auth = { loading: true, user: null, session: null };
const mockClear = jest.fn(() => Promise.resolve());
const mockReset = jest.fn(() => Promise.resolve());

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/clearUserData', () => ({ clearUserData: () => mockClear() }));
jest.mock('@/lib/react-query', () => ({ queryClient: {} }));
jest.mock('@/lib/authCache', () => ({
  ...jest.requireActual('@/lib/authCache'),
  resetUserQueries: () => mockReset(),
}));

const launching = (savedUser: string | null): Auth => ({ loading: true, user: savedUser ? { id: savedUser } : null, session: null });
const settled = (id: string | null): Auth => ({ loading: false, user: id ? { id } : null, session: id ? { user: { id } } : null });

/** Renders the hook through each auth state in turn; returns what it did. */
async function run(...states: Auth[]) {
  mockClear.mockClear();
  mockReset.mockClear();
  mockAuth = states[0];
  const { rerender, unmount } = await renderHook(() => useUserCacheSync());
  for (const state of states.slice(1)) {
    mockAuth = state;
    await rerender({});
  }
  await unmount();
  return { cleared: mockClear.mock.calls.length, reset: mockReset.mock.calls.length };
}

test("the saved user's refresh succeeds: their cached screens stay", async () => {
  expect(await run(launching(null), launching('a'), settled('a'))).toEqual({ cleared: 0, reset: 0 });
});

test("the saved user's refresh fails: their cached data is forgotten", async () => {
  expect(await run(launching(null), launching('a'), settled(null))).toEqual({ cleared: 1, reset: 0 });
});

test('auth settles on someone other than the saved user: everything refetches', async () => {
  expect(await run(launching('a'), settled('b'))).toEqual({ cleared: 0, reset: 1 });
});

test('as before: relaunch signed in, open signed out, sign in, sign out', async () => {
  expect(await run(launching(null), settled('a'))).toEqual({ cleared: 0, reset: 0 });
  expect(await run(launching(null), settled(null))).toEqual({ cleared: 1, reset: 0 });
  expect(await run(launching(null), settled(null), settled('a'))).toEqual({ cleared: 1, reset: 1 });
  expect(await run(launching('a'), settled('a'), settled(null))).toEqual({ cleared: 1, reset: 0 });
});
