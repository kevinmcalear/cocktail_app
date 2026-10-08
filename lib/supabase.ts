import { createClient, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { storedSessionUser } from '@/lib/authCache';

// Return the write promises: auth-js awaits them before announcing SIGNED_IN,
// and every request reads its token back from here. Unawaited, the first
// requests after sign-in could go out anon.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const WebStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window === 'undefined' || typeof localStorage?.getItem !== 'function') return null;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined' || typeof localStorage?.setItem !== 'function') return;
    localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined' || typeof localStorage?.removeItem !== 'function') return;
    localStorage.removeItem(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const authStorage = Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter;
// supabase-js's default key, spelled out so readStoredUser reads the same entry.
// Changing it would sign everyone out.
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

/**
 * The user of the session saved on this device, without waiting for auth-js:
 * its initialization refreshes an expired access token over the network
 * before getSession() answers. For painting cached screens only; it isn't a
 * confirmed session (see ctx/AuthContext.tsx).
 */
export async function readStoredUser(): Promise<User | null> {
  return storedSessionUser(await authStorage.getItem(authStorageKey));
}

/**
 * Deletes the session saved on this device without asking the server, for
 * signing out when auth-js can't (offline). auth-js reads it from storage on
 * every call, so it's signed out from here on.
 */
export async function forgetStoredSession(): Promise<void> {
  await authStorage.removeItem(authStorageKey);
}

/**
 * Cache lifetime for files the app uploads: a year. Every upload gets a new
 * path (a timestamp, never upserted), so a cached copy is never stale, and
 * phones and browsers stop asking again for photos they already have.
 */
export const UPLOAD_CACHE_SECONDS = '31536000';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey: authStorageKey,
    // Static web rendering runs this module in Node, where auth-js would start a
    // permanent refresh timer and keep `expo export` from exiting.
    autoRefreshToken: Platform.OS !== 'web' || typeof window !== 'undefined',
    persistSession: true,
    // ponytail: never auto-exchange on load — mail scanners burn one-time links.
    // EmailLinkGate exchanges on an explicit Continue tap instead.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
