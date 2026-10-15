import { Platform } from 'react-native';
import { create } from 'zustand';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Settings › Try it, "New in the tab bar": on phones, New sits in the tab bar
 * instead of the header. Wide web keeps its sidebar (New) either way.
 */
export function useBottomBar(): boolean {
  const on = useSettingsStore((s) => s.bottomBar);
  const wide = useIsWideWeb();
  return on && !wide;
}

/**
 * Phones search at the bottom, over the keyboard (search-start, decided
 * 15 Oct 2026). Wide web searches in the ⌘K palette, and its /search page
 * keeps the field at the top.
 */
export function useBottomSearch(): boolean {
  return !useIsWideWeb();
}

/**
 * iOS 26 turns the tab bar itself into the search field when the search tab's
 * screen has a native search bar, so there search uses the system's.
 * Everywhere else (Android, phone web, older iOS) draws its own bottom field.
 * ponytail: iOS 27 only does that for a real UISearchTab, which
 * react-native-screens builds from 4.29 (software-mansion/react-native-screens#4671);
 * on 4.28 the system field lands at the top, so iOS 27 draws ours too. Widen
 * this to `>= 26` again with that upgrade (a native build).
 */
const IOS_MAJOR = Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const SYSTEM_BOTTOM_SEARCH = IOS_MAJOR === 26;

/** Phone web: the bottom search field has focus, so it takes the tab bar's place (WebTabBar steps aside). */
export const useBottomSearchFocus = create<{ focused: boolean }>(() => ({ focused: false }));
