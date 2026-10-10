import { track } from '@/lib/analytics';
import { isFirstSignIn, type AuthProblem } from '@/lib/authCode';
import { getAuthRedirectTo } from '@/lib/authRedirect';
import { forgetStoredSession, readStoredUser, supabase } from '@/lib/supabase';
import { isAuthRetryableFetchError, Session, User } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type AuthContextType = {
  /** The confirmed session. Null until auth-js has settled (refreshed an expired token, if it had to). */
  session: Session | null;
  /**
   * Who is signed in. While `loading`, it can be the user of the session saved
   * on this device, read before auth-js has refreshed it, so the first screen
   * paints their cached data instead of waiting on the network. Requests still
   * wait: the Supabase client refreshes before reading its token. If the
   * server rejects the refresh, it becomes null as auth settles, as for any
   * sign-out. If the server can't be reached, it stays (see `loading`).
   */
  user: User | null;
  /**
   * True until auth-js settles. `user` may be the saved one until then; `session` is null.
   * Launched offline with an expired token, it stays true (with the saved
   * user) until the refresh gets through: cached screens stay up under the
   * offline banner instead of signing out and forgetting them.
   */
  loading: boolean;
  /**
   * Emails a sign-in code (and a link that works on that device). The same
   * call signs a new person up: there's no separate sign-up and no password.
   */
  sendCode: (email: string) => Promise<{ error: AuthProblem | null }>;
  /** Signs in with the code from that email. */
  verifyCode: (email: string, code: string) => Promise<{ error: AuthProblem | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    /** False on a new account until setup finishes. Existing accounts leave it unset. */
    onboarded?: boolean;
    avatarUrl?: string;
  }) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  sendCode: async () => ({ error: null }),
  verifyCode: async () => ({ error: null }),
  signOut: async () => {},
  updateProfile: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

/**
 * Who is signed in, by id, and whether auth has settled: the same values as
 * `useAuth().user?.id` and `useAuth().loading`, in their own context. auth-js
 * refreshes the token hourly, which gives `session` and `user` new objects and
 * re-renders every useAuth() consumer; this value only changes when the id or
 * `loading` does. Most screens and hooks only need this.
 */
type AuthIdentity = { userId: string | null; loading: boolean };

const AuthIdentityContext = createContext<AuthIdentity>({ userId: null, loading: true });

/** The signed-in user's id, or null: `useAuth().user?.id ?? null`, without the token-refresh re-renders. */
export const useUserId = () => useContext(AuthIdentityContext).userId;
/** Whether someone is signed in: `!!useAuth().user`, without the token-refresh re-renders. */
export const useSignedIn = () => useContext(AuthIdentityContext).userId !== null;
/** The id and `loading` together, for screens that wait on auth. */
export const useAuthIdentity = () => useContext(AuthIdentityContext);

function asError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

function asProblem(error: { message: string; code?: string } | null): AuthProblem | null {
  return error ? { message: error.message, code: error.code } : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  /** Signed out on this device only (offline), until someone signs in. */
  const forgotLocally = useRef(false);

  useEffect(() => {
    let settled = false;
    let waitingForNetwork = false;
    const settle = (next: Session | null) => {
      settled = true;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    };

    // getSession() answers null both when the server rejects the refresh
    // token (auth-js has then deleted the saved session and announced
    // SIGNED_OUT) and when it can't be reached (offline, flaky wifi): auth-js
    // keeps the saved session and returns an AuthRetryableFetchError. Only the
    // first is a sign-out. For the second, stay unsettled with the saved user
    // and try again once back online. auth-js's own 30s refresh ticker also
    // keeps trying, for wifi that's connected but not getting through.
    const load = () =>
      supabase.auth
        .getSession()
        .then(async ({ data: { session: next }, error }) => {
          if (!next && isAuthRetryableFetchError(error)) {
            const stored = await readStoredUser().catch(() => null);
            if (stored && !settled) {
              setUser(stored);
              waitingForNetwork = true;
              return;
            }
          }
          settle(next);
        })
        .catch(() => settle(null));
    const retryOnline = onlineManager.subscribe((online) => {
      if (!online || !waitingForNetwork || settled) return;
      waitingForNetwork = false;
      load();
    });

    // getSession() waits on auth-js's initialization, which refreshes an
    // expired access token (they last an hour) over the network first. Read
    // the saved session's user meanwhile, in an effect so web hydration
    // matches the static HTML, and only until auth settles.
    readStoredUser()
      .then((stored) => {
        if (!settled && stored) setUser(stored);
      })
      .catch(() => {});

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      // Says the same as getSession() above, minus the error that tells
      // offline apart from signed out.
      if (event === 'INITIAL_SESSION') return;
      // A refresh auth-js started before an offline sign-out can get through
      // after it and save the session again. Nobody is signed in to refresh.
      if (event === 'TOKEN_REFRESHED' && forgotLocally.current) {
        forgetStoredSession().catch(() => {});
        return;
      }
      if (event === 'SIGNED_IN') forgotLocally.current = false;
      settle(next);
    });

    return () => {
      subscription.unsubscribe();
      retryOnline();
    };
  }, []);

  const sendCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: getAuthRedirectTo('/auth/callback'),
        // Only kept when this makes a new account: setup runs once, after the age check.
        data: { onboarded: false },
      },
    });
    return { error: asProblem(error) };
  };

  const verifyCode = async (email: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (!error && data.user && isFirstSignIn(data.user)) track('sign_up');
    return { error: asProblem(error) };
  };

  const signOut = async () => {
    // Offline, auth-js can't sign out (it calls the server first, after
    // refreshing an expired token) and keeps the saved session. Bar iPads are
    // shared, so forget it here and sign out now. ponytail: that refresh token
    // isn't revoked on the server; it lapses on its own. Revoke it on the next
    // online launch if that ever matters.
    if (session) {
      const { error } = await supabase.auth.signOut();
      if (!error) return;
    }
    forgotLocally.current = true;
    await forgetStoredSession();
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  const updateProfile = async ({
    firstName,
    lastName,
    fullName,
    onboarded,
    avatarUrl,
  }: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    onboarded?: boolean;
    avatarUrl?: string;
  }) => {
    const updates: { data: Record<string, string | boolean> } = { data: {} };
    if (firstName) updates.data.first_name = firstName;
    if (lastName !== undefined) updates.data.last_name = lastName;
    if (fullName) updates.data.full_name = fullName;
    if (onboarded !== undefined) updates.data.onboarded = onboarded;
    if (avatarUrl) updates.data.avatar_url = avatarUrl;

    if (Object.keys(updates.data).length === 0) {
      return { error: null };
    }

    const { error } = await supabase.auth.updateUser(updates);
    if (!error) {
      const {
        data: { session: next },
      } = await supabase.auth.getSession();
      if (next) {
        setSession(next);
        setUser(next.user);
      }
    }
    return { error: asError(error) };
  };

  const userId = user?.id ?? null;
  const identity = useMemo(() => ({ userId, loading }), [userId, loading]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        sendCode,
        verifyCode,
        signOut,
        updateProfile,
      }}
    >
      <AuthIdentityContext.Provider value={identity}>{children}</AuthIdentityContext.Provider>
    </AuthContext.Provider>
  );
}
