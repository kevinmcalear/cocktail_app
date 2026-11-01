import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useUserId } from '@/ctx/AuthContext';
import { pickSpecView, type SpecView } from '@/lib/specView';

interface SpecViewState {
  /** Each person's last Ingredients | Steps pick on this device, by user id ('' signed out). */
  views: Record<string, SpecView>;
  setView: (person: string, view: SpecView) => void;
}

/**
 * The spec's Ingredients | Steps switch, remembered per person (decision
 * spec-toggle: sticky). Kept on the device until it can live on the person's
 * profile (a user_prefs column, gated), so two people sharing a phone keep
 * their own.
 */
export const useSpecViewStore = create<SpecViewState>()(
  persist(
    (set) => ({
      views: {},
      setView: (person, view) => set((s) => (s.views[person] === view ? s : { views: { ...s.views, [person]: view } })),
    }),
    { name: 'spec-view', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/**
 * The view this person reads specs in, and a setter that remembers it. Until
 * they pick, `maker` decides: Steps for people who make the drink, Ingredients
 * for everyone else.
 */
export function useSpecView(maker: boolean): [SpecView, (view: SpecView) => void] {
  const person = useUserId() ?? '';
  const views = useSpecViewStore((s) => s.views);
  const setView = useSpecViewStore((s) => s.setView);
  return [pickSpecView(views, person, maker), (view) => setView(person, view)];
}
