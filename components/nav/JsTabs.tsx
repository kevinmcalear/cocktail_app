import { Tabs } from 'expo-router';
import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { TABS } from '@/lib/tabs';

import { useSeeThroughOpen } from './useUnderSeeThrough';
import { VenueBrandProvider } from './VenueBrandProvider';
import { WebTabBar } from './WebTabBar';

/**
 * The tabs drawn in JS: all of the web (NativeTabs has no web implementation),
 * and a native iPad wide enough for the side nav. The same four tabs as the
 * phone: phone-width web gets the glass tab bar with its search circle, which
 * pushes /search on the tab's stack. At a venue that hasn't switched Tonight
 * on, the bar and the side nav leave it out (useWebTabs) and its route sends
 * you to Drinks; the screen stays registered, or / would have nothing to
 * render. Wide screens hide the bar, use the side
 * nav in the root layout and search in the ⌘K palette. iOS's search tab,
 * (search), has no place here.
 */
export function JsTabs() {
  const isWideWeb = useIsWideWeb();
  // The search starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  // Under a create wizard (seeThrough.ts) the tabs are out of reach: Tab stays in the wizard's page, not the tab bar behind it.
  // On the web aria-hidden alone leaves them in the tab order; inert takes them out (as DiscoverScreen's list).
  const covered = useSeeThroughOpen();
  const root = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    (root.current as unknown as { toggleAttribute?: (name: string, on: boolean) => void } | null)?.toggleAttribute?.('inert', covered);
  }, [covered]);
  return (
    <VenueBrandProvider>
      <View ref={root} style={styles.flex}>
        <Tabs tabBar={isWideWeb ? () => null : (props) => <WebTabBar {...props} />} screenOptions={{ headerShown: false }}>
          {TABS.map((t) => (
            <Tabs.Screen key={t.name} name={t.route} options={{ title: t.label }} />
          ))}
          <Tabs.Screen name="(search)" options={{ href: null }} />
        </Tabs>
      </View>
    </VenueBrandProvider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
