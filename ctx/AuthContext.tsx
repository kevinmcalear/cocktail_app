import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: any }>;
    signUp: (email: string, password: string) => Promise<{ data: any; error: any }>;
    signOut: () => Promise<void>;
    updateProfile: (data: { firstName?: string; lastName?: string; password?: string; avatarUrl?: string }) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signIn: async () => ({ error: null }),
    signUp: async () => ({ data: null, error: null }),
    signOut: async () => { },
    updateProfile: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        return { data, error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const updateProfile = async ({ firstName, lastName, password, avatarUrl }: { firstName?: string; lastName?: string; password?: string; avatarUrl?: string }) => {
        const updates: any = {
            data: {},
        };

        if (firstName) updates.data.first_name = firstName;
        if (lastName) updates.data.last_name = lastName;
        if (avatarUrl) updates.data.avatar_url = avatarUrl;
        if (password) updates.password = password;

        if (Object.keys(updates.data).length === 0 && !updates.password) {
            return { error: null };
        }

        const { error } = await supabase.auth.updateUser(updates);

        if (!error && session) {
            // refresh session
            const { data: { session: newSession }, error: refreshError } = await supabase.auth.getSession();
            if (newSession) {
                setSession(newSession);
                setUser(newSession.user);
            }
        }

        return { error };
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                loading,
                signIn,
                signUp,
                signOut,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
