import { Platform } from 'react-native';
import { create } from 'zustand';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';

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
 * Phone web and older iOS draw their own bottom field; Android's is on top.
 */
const IOS_MAJOR = Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
export const SYSTEM_BOTTOM_SEARCH = IOS_MAJOR >= 26;

/**
 * Search is a tab only on iPhone, the system's search circle ((tabs)/(search)).
 * Android and phone web push /search over the tabs instead (Android has exactly
 * four tabs, Prod-and; the web's circle opens the same page).
 */
export const SEARCH_TAB = Platform.OS === 'ios';

/** Phone web: a bottom search field has focus (Discover's sheet), so it takes the tab bar's place (WebTabBar steps aside). */
export const useBottomSearchFocus = create<{ focused: boolean }>(() => ({ focused: false }));
