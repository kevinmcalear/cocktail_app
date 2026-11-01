import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { useDs } from '@/components/ds';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { useServiceDay } from '@/hooks/useServiceDay';
import { withAlpha } from '@/lib/color';
import { TABS } from '@/lib/tabs';

import { JsTabs } from './JsTabs';
import { useMaterialRoles } from './material';
import { TAB_IMAGES, tonightImage } from './tabImages';
import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * The four tabs on iPhone and Android (tabs A, 31 Oct 2026): Tonight, Drinks,
 * Discover and You, the same for everyone; the mode changes what each shows.
 * The system tab bar (Liquid Glass on iOS 26+, Material 3 on Android), tinted
 * with the venue's accent. Each tab holds its own stack
 * (app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/_layout.tsx). The place
 * button and the + sit in each page's header (ScreenHeader.tsx); Android's
 * Add is the extended FAB. Web uses JsTabs.tsx.
 * Search (Prod-nav-A, Prod-and): iOS has the system's search circle beside the
 * tabs, a real search tab ((tabs)/(search)) that turns the bar into the field.
 * Android has exactly four tabs: its search is the bar on top of the page,
 * which pushes /search on the tab's own stack, since a tab with no item in the
 * bar can't be navigated to. Open, Material's search view takes the whole
 * screen, so the nav bar steps aside (Miss-search-and).
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
  const roles = useMaterialRoles();
  const page = (useSegments() as string[])[2];
  // The search circle starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  // Android's Material 3 bar in our colours (Prod-and): ink icons and labels, the indicator pill
  // and an ink ripple. iOS keeps the system's Liquid Glass untouched.
  const material = {
    backgroundColor: roles.nav,
    indicatorColor: roles.indicator,
    rippleColor: withAlpha(ds.c.ink, 0.12),
    iconColor: { default: ds.c.ink, selected: roles.onIndicator },
    labelStyle: { default: { color: ds.c.ink, fontWeight: '500' }, selected: { color: roles.onIndicator, fontWeight: '600' } },
  } as const;
  // Android's Material bar hides unselected labels past three tabs; "labeled" keeps every tab named.
  return (
    <NativeTabs
      tintColor={Platform.OS === 'android' ? roles.onIndicator : ds.accentText}
      badgeBackgroundColor={ds.accentFill.fill}
      minimizeBehavior="onScrollDown"
      labelVisibilityMode="labeled"
      hidden={Platform.OS === 'android' && page === 'search'}
      {...(Platform.OS === 'android' ? material : null)}
    >
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.route}>
          <NativeTabs.Trigger.Icon src={IMAGES[t.name] ?? tonightImage(day)} renderingMode="template" />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
      {Platform.OS === 'ios' ? (
        // iOS 27 only moves the search field into the tab bar for a real UISearchTab that activates
        // search when picked (react-native-screens 4.29+). expo-router forwards role="search" only as the
        // legacy system item, so the screen props ask for the search tab directly. No icon: iOS draws the
        // system magnifying glass from the role. ponytail: drop unstable_nativeProps once expo-router
        // forwards them (expo/expo#51876).
        <NativeTabs.Trigger name="(search)" role="search" unstable_nativeProps={{ ios: { role: 'search', automaticallyActivatesSearch: true } }}>
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}
    </NativeTabs>
  );
}
