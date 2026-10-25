import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The drink drafts this device has seen in the account (hooks/useDraftSync):
 * one of those gone from the account was saved or started over on another
 * device, so it goes here too. Cleared on sign out.
 */
export const useDraftSyncStore = create<{ seen: string[] }>()(persist(() => ({ seen: [] as string[] }), { name: 'draft-sync', storage: createJSONStorage(() => AsyncStorage) }));
