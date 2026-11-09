import { useIsFocused, useNavigation } from 'expo-router';
import { TabActions } from 'expo-router/react-navigation';
import { useEffect, useRef } from 'react';

import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { TABS, type Tab } from '@/lib/tabs';

/**
 * A link from outside the tabs opened cold (a create wizard's dialog,
 * Settings): the router puts a tab under it, not the one the app opens on.
 * Each tab's first page (`path`) calls this, and the one under that page moves
 * the tabs to the start (/, or /drinks with Tonight switched off) without
 * leaving the page, so the wizard's dialog sits over it and its X lands there.
 * A page opened from a tab stays over that tab (it had focus first). Not an
 * anchor on the tabs: that adds Tonight's code to every page's first load.
 */
export function useStartTabUnder(path: Tab['path']) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const { ready, home } = useVenueFeatures();
  // Mounted while a page covered the tabs: a cold link. Done once this tab has had focus.
  const cold = useRef(!focused);
  useEffect(() => {
    if (focused) cold.current = false;
    if (!cold.current || !ready || home === path) return;
    const tabs = navigation.getParent();
    const state = tabs?.getState();
    // Only under a page over the tabs (a drink pushed on this tab stays), and only while this tab is the one
    // the tabs show: a tab left behind stays where it was left.
    if (!tabs || !state || tabs.isFocused() || state.routes[state.index]?.state?.key !== navigation.getState()?.key) return;
    const start = TABS.find((t) => t.path === home);
    cold.current = false;
    if (start) tabs.dispatch(TabActions.jumpTo(start.route));
  }, [focused, ready, home, path, navigation]);
}
