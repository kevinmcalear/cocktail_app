import { track } from '@/lib/analytics';
import { getAuthRedirectTo } from '@/lib/authRedirect';
import { forgetStoredSession, readStoredUser, supabase } from '@/lib/supabase';
import { isAuthRetryableFetchError, Session, User } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

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
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ session: Session | null; error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    /** False on a new account until setup finishes. Existing accounts leave it unset. */
    onboarded?: boolean;
    password?: string;
    avatarUrl?: string;
  }) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  passwordRecovery: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ session: null, error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  resendConfirmation: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

function asError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
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
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      settle(next);
    });

    return () => {
      subscription.unsubscribe();
      retryOnline();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: asError(error) };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectTo('/auth/callback'), data: { onboarded: false } },
    });
    if (!error) track('sign_up');
    return { session: data.session, error: asError(error) };
  };

  const signOut = async () => {
    setPasswordRecovery(false);
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

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectTo('/auth/reset-password'),
    });
    return { error: asError(error) };
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectTo('/auth/callback') },
    });
    return { error: asError(error) };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return { error: asError(error) };
  };

  const updateProfile = async ({
    firstName,
    lastName,
    fullName,
    onboarded,
    password,
    avatarUrl,
  }: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    onboarded?: boolean;
    password?: string;
    avatarUrl?: string;
  }) => {
    const updates: { data: Record<string, string | boolean>; password?: string } = { data: {} };
    if (firstName) updates.data.first_name = firstName;
    if (lastName !== undefined) updates.data.last_name = lastName;
    if (fullName) updates.data.full_name = fullName;
    if (onboarded !== undefined) updates.data.onboarded = onboarded;
    if (avatarUrl) updates.data.avatar_url = avatarUrl;
    if (password) updates.password = password;

    if (Object.keys(updates.data).length === 0 && !updates.password) {
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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        passwordRecovery,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
        updatePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
