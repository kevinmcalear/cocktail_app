import { router, useNavigation, useSegments, type Href } from 'expo-router';

import { TABS } from '@/lib/tabs';

/**
 * Back on an item page, the same on iOS, Android and the web (Kevin, 3 Nov:
 * Back always shows). With a page under this one it goes there. A shared page
 * can open at the bottom of its stack (a cold link opens in Tonight's group,
 * lib/tabs.ts; a restored app), and then Back goes to the first page of the
 * tab or search it is in.
 */
export function useItemBack() {
  const navigation = useNavigation();
  const group = (useSegments() as string[])[1];
  const home = group === '(search)' ? '/search' : (TABS.find((t) => t.route === group)?.path ?? '/');
  // Opened from a page above the tabs (a menu, /menus/[id]), the tab's stack has nothing under it but the app does.
  return () => (navigation.canGoBack() ? navigation.goBack() : router.canGoBack() ? router.back() : router.replace(home as Href));
}
