import { useIsFocused, useNavigation } from 'expo-router';
import { TabActions } from 'expo-router/react-navigation';
import { useEffect } from 'react';

import { TABS } from '@/lib/tabs';

/**
 * The first tab, when the start is another (`home`: Drinks, with Tonight
 * switched off), showing under a page a link opened over the tabs (the tabs'
 * anchor is the first tab, app/(tabs)/_layout.tsx). The tabs move to the start
 * under that page without leaving it, so a create wizard's dialog sits over
 * Drinks and its X lands there. A Redirect can't: it waits for this tab's
 * focus, which comes only once the page has gone.
 */
export function useStartTabUnder(home: string | null) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  useEffect(() => {
    if (!home || focused) return;
    const tabs = navigation.getParent();
    const state = tabs?.getState();
    // Only while this tab is the one the tabs show: a tab left behind stays where it was left.
    if (!tabs || !state || state.routes[state.index]?.state?.key !== navigation.getState()?.key) return;
    const start = TABS.find((t) => t.path === home);
    if (start) tabs.dispatch(TabActions.jumpTo(start.route));
  }, [home, focused, navigation]);
}
