import { createSessionFromUrl } from '@/lib/createSessionFromUrl';
import { getAuthRedirectTo } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type AuthContextType = {
  session: Session | null;
  user: User | null;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: next } }) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Native deep links only — web exchanges via EmailLinkGate on Continue tap
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        await createSessionFromUrl(url);
      } catch (e) {
        console.warn('Auth deep link failed', e);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return () => sub.remove();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: asError(error) };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectTo('/auth/callback') },
    });
    return { session: data.session, error: asError(error) };
  };

  const signOut = async () => {
    setPasswordRecovery(false);
    await supabase.auth.signOut();
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
    password,
    avatarUrl,
  }: {
    firstName?: string;
    lastName?: string;
    password?: string;
    avatarUrl?: string;
  }) => {
    const updates: { data: Record<string, string>; password?: string } = { data: {} };
    if (firstName) updates.data.first_name = firstName;
    if (lastName) updates.data.last_name = lastName;
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
