import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
        SecureStore.deleteItemAsync(key);
    },
};

const WebStorageAdapter = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') return null;
        if (typeof localStorage === 'undefined') return null;
        if (typeof localStorage.getItem !== 'function') return null;
        return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        if (typeof localStorage === 'undefined') return;
        if (typeof localStorage.setItem !== 'function') return;
        localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        if (typeof localStorage === 'undefined') return;
        if (typeof localStorage.removeItem !== 'function') return;
        localStorage.removeItem(key);
    },
};

// TODO: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
