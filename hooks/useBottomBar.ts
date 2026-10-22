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
 * iOS 26 and later turn the tab bar itself into the search field when the
 * search tab's screen has a native search bar, so there search uses the
 * system's (on iOS 27 that needs the real search tab AppTabs asks for).
 * Everywhere else (Android, phone web, older iOS) draws its own bottom field.
 */
const IOS_MAJOR = Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const SYSTEM_BOTTOM_SEARCH = IOS_MAJOR >= 26;

/** Phone web: the bottom search field has focus, so it takes the tab bar's place (WebTabBar steps aside). */
export const useBottomSearchFocus = create<{ focused: boolean }>(() => ({ focused: false }));
