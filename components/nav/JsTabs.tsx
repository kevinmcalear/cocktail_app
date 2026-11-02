import { Tabs } from 'expo-router';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { TABS } from '@/lib/tabs';

import { VenueBrandProvider } from './VenueBrandProvider';
import { WebTabBar } from './WebTabBar';

/**
 * The tabs drawn in JS: all of the web (NativeTabs has no web implementation),
 * and a native iPad wide enough for the side nav. The same four tabs as the
 * phone: phone-width web gets the glass tab bar with its search circle, which
 * pushes /search on the tab's stack; wide screens hide the bar, use the side
 * nav in the root layout and search in the ⌘K palette. iOS's search tab,
 * (search), has no place here.
 */
export function JsTabs() {
  const isWideWeb = useIsWideWeb();
  // The search starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  return (
    <VenueBrandProvider>
      <Tabs tabBar={isWideWeb ? () => null : (props) => <WebTabBar {...props} />} screenOptions={{ headerShown: false }}>
        {TABS.map((t) => (
          <Tabs.Screen key={t.name} name={t.route} options={{ title: t.label }} />
        ))}
        <Tabs.Screen name="(search)" options={{ href: null }} />
      </Tabs>
    </VenueBrandProvider>
  );
}
