import { Tabs } from 'expo-router';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';

import { VenueBrandProvider } from './VenueBrandProvider';
import { WebTabBar } from './WebTabBar';

/**
 * Redesigned tabs on web. NativeTabs has no web implementation, so phone-width
 * web gets the glass tab bar and wide web uses the sidebar in the root layout.
 */
export function AppTabs() {
  const isWideWeb = useIsWideWeb();
  // The search starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  return (
    <VenueBrandProvider>
      <Tabs tabBar={isWideWeb ? () => null : (props) => <WebTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: 'Tonight' }} />
        <Tabs.Screen name="library" options={{ title: 'Library' }} />
        <Tabs.Screen name="menus" options={{ title: 'Menus' }} />
        <Tabs.Screen name="prep" options={{ title: 'Prep' }} />
        <Tabs.Screen name="test" options={{ title: 'Study' }} />
        <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
        <Tabs.Screen name="bar" options={{ title: 'My Bar' }} />
        <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
        <Tabs.Screen name="search" options={{ title: 'Search' }} />
        <Tabs.Screen name="new" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ title: 'You' }} />
      </Tabs>
    </VenueBrandProvider>
  );
}
