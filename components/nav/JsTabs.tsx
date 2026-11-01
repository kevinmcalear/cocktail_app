import { Tabs } from 'expo-router';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { TABS } from '@/lib/tabs';

import { VenueBrandProvider } from './VenueBrandProvider';
import { WebTabBar } from './WebTabBar';

/**
 * The tabs drawn in JS: all of the web (NativeTabs has no web implementation),
 * and a native iPad wide enough for the side nav. The same four tabs and
 * Search as the phone: phone-width web gets the glass tab bar; wide screens
 * hide the bar and use the side nav in the root layout.
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
        <Tabs.Screen name="search" options={{ title: 'Search' }} />
      </Tabs>
    </VenueBrandProvider>
  );
}
