import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { useDs } from '@/components/ds';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { useServiceDay } from '@/hooks/useServiceDay';
import { withAlpha } from '@/lib/color';
import { TABS } from '@/lib/tabs';

import { JsTabs } from './JsTabs';
import { TAB_IMAGES, tonightImage } from './tabImages';
import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * The four tabs on iPhone and Android (tabs A, 31 Oct 2026): Tonight, Drinks,
 * Discover and You, the same for everyone; the mode changes what each shows.
 * The system tab bar (Liquid Glass on iOS 26+, Material 3 on Android), tinted
 * with the venue's accent, with Search beside them. Each tab holds its own
 * stack (app/(tabs)/(tonight,drinks,discover,you)/_layout.tsx). The place
 * button and the + sit in each page's header (ScreenHeader.tsx); Android's
 * Add is the extended FAB. Web uses JsTabs.tsx.
 * Tonight is a calendar page showing the date, which turns over at 6am.
 * The icons are the app's own (components/nav/tabImages.ts), template images
 * the system tints, so the glass and Material bars stay the system's.
 * A native iPad wide enough for the side nav uses the JS tabs instead, with
 * the rail or sidebar in the root layout, like tablet web (24 Oct 2026).
 * ponytail: crossing 768 (Split View, Stage Manager) swaps navigators and
 * resets the tabs' stacks. Upgrade path: one navigator whose bar hides.
 */
export function AppTabs() {
  const wide = useIsWideWeb();
  if (wide) return <JsTabs />;
  return (
    <VenueBrandProvider>
      <Tabs />
    </VenueBrandProvider>
  );
}

const IMAGES = { tonight: null, drinks: TAB_IMAGES.drinks, discover: TAB_IMAGES.discover, you: TAB_IMAGES.you } as const;

function Tabs() {
  const ds = useDs();
  const day = useServiceDay() ?? 1;
  // The search circle starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  // Android's Material 3 bar in our colours: the surface, the accent's indicator pill (the
  // sidebar's current-row tint) and an ink ripple. iOS keeps the system's Liquid Glass untouched.
  const material = { backgroundColor: ds.c.surface, indicatorColor: withAlpha(ds.accentText, 0.16), rippleColor: withAlpha(ds.c.ink, 0.12) };
  // Android's Material bar hides unselected labels past three tabs; "labeled" keeps every tab named.
  return (
    <NativeTabs
      tintColor={ds.accentText}
      badgeBackgroundColor={ds.accentFill.fill}
      minimizeBehavior="onScrollDown"
      labelVisibilityMode="labeled"
      {...(Platform.OS === 'android' ? material : null)}
    >
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.route}>
          <NativeTabs.Trigger.Icon src={IMAGES[t.name] ?? tonightImage(day)} renderingMode="template" />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
        {/* iOS 27 only moves the search field into the tab bar for a real
            UISearchTab that activates search when picked (react-native-screens
            4.29+). expo-router forwards role="search" only as the legacy system
            item, so the screen props ask for the search tab directly.
            ponytail: drop unstable_nativeProps once expo-router forwards them
            (expo/expo#51876). */}
        <NativeTabs.Trigger name="search" role="search" unstable_nativeProps={{ ios: { role: 'search', automaticallyActivatesSearch: true } }}>
          {/* iOS draws the system magnifying glass from role="search": no image there, or it
              would replace the system's. Android has no search role, so it takes ours. */}
          <NativeTabs.Trigger.Icon src={Platform.OS === 'android' ? TAB_IMAGES.search : undefined} renderingMode="template" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
    </NativeTabs>
  );
}
