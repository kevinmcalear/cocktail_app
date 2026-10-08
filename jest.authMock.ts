/**
 * A stand-in for ctx/AuthContext built from a mocked useAuth(): the narrow
 * hooks (useUserId, useSignedIn, useAuthIdentity) read the same user, as the
 * real provider's do. In a test:
 *   jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => mockAuth));
 */
type MockAuth = { user?: { id: string } | null; loading?: boolean };

export function mockAuthContext(useAuth: () => MockAuth) {
  const useUserId = () => useAuth().user?.id ?? null;
  return {
    useAuth,
    useUserId,
    useSignedIn: () => useUserId() !== null,
    useAuthIdentity: () => ({ userId: useUserId(), loading: useAuth().loading ?? false }),
  };
}
