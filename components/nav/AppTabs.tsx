import { NativeTabs } from 'expo-router/native-tabs';
import { useState } from 'react';
import { View } from 'react-native';

import { useDs } from '@/components/ds';
import { useFeatureNewsDots } from '@/hooks/useFeatureNews';
import { useFirstRound } from '@/hooks/useFirstRound';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { useTrackTab } from '@/hooks/useSearchFrom';
import { useServiceDay } from '@/hooks/useServiceDay';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { phoneTabs, type PhoneTab, type VenueTab } from '@/lib/venueFeatures';

import { CreateSheet } from './CreateSheet';
import { JsTabs } from './JsTabs';
import { NEW_TAB_IMAGE, TAB_IMAGES, tonightImage } from './tabImages';
import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * Redesigned tabs on iOS and Android: the system tab bar (Liquid Glass on
 * iOS 26+, Material 3 on Android), tinted with the venue's accent. Web uses
 * JsTabs.tsx. Venue mode: Library, Menus, Discover, plus Tonight, Prep
 * and Study when the venue switched them on (lib/venueFeatures.ts). Home
 * mode: Discover, My Bar, Collection. New is a tab in both, and the bar stays
 * at five with Search (lib/venueFeatures.ts phoneTabs); You opens from the
 * header's avatar.
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

function Tabs() {
  const ds = useDs();
  const { mode, ready } = useMode();
  const features = useVenueFeatures();
  const home = mode === 'home';
  const day = useServiceDay() ?? 1;
  const [creating, setCreating] = useState(false);
  // A new tab the venue switched on keeps a dot until it's first opened (hooks/useFeatureNews.ts).
  const dots = useFeatureNewsDots();
  const isNew = (name: VenueTab) => dots.includes(name);
  const dot = (name: VenueTab) => <NativeTabs.Trigger.Badge hidden={!isNew(name)} />;
  // The first round holds Menus and Discover back until their steps come up (lib/firstRound.ts).
  const { hidden } = useFirstRound();
  // The search circle starts on the tab it was opened from (hooks/useSearchFrom.ts).
  useTrackTab();
  // Venue and home have different tabs, and switching remounts them all:
  // wait for the mode (a moment, on a first launch) and the venue's switches
  // rather than open the wrong set.
  if (!ready || !features.ready) return <View style={{ flex: 1, backgroundColor: ds.c.ground }} />;
  const shown = phoneTabs(home, features.has);
  const off = (name: PhoneTab) => !shown.includes(name) || (hidden as readonly string[]).includes(name);
  // Discover is in both modes. The rest swap, the way an account switch swaps
  // an app's tabs; home mode's index redirects to Discover. Android's Material
  // bar hides unselected labels past three tabs; "labeled" keeps every tab named.
  return (
    <>
      <NativeTabs tintColor={ds.accentText} badgeBackgroundColor={ds.accentFill.fill} minimizeBehavior="onScrollDown" labelVisibilityMode="labeled">
        <NativeTabs.Trigger name="index" hidden={off('index')} accessibilityLabel={isNew('index') ? 'Tonight, new' : undefined}>
          <NativeTabs.Trigger.Icon src={tonightImage(day)} renderingMode="template" />
          <NativeTabs.Trigger.Label>Tonight</NativeTabs.Trigger.Label>
          {dot('index')}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="library" hidden={off('library')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.library} renderingMode="template" />
          <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="menus" hidden={off('menus')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.menus} renderingMode="template" />
          <NativeTabs.Trigger.Label>Menus</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="prep" hidden={off('prep')} accessibilityLabel={isNew('prep') ? 'Prep, new' : undefined}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.prep} renderingMode="template" />
          <NativeTabs.Trigger.Label>Prep</NativeTabs.Trigger.Label>
          {dot('prep')}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="test" hidden={off('test')} accessibilityLabel={isNew('test') ? 'Study, new' : undefined}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.test} renderingMode="template" />
          <NativeTabs.Trigger.Label>Study</NativeTabs.Trigger.Label>
          {dot('test')}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="discover" hidden={off('discover')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.discover} renderingMode="template" />
          <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="bar" hidden={off('bar')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.bar} renderingMode="template" />
          <NativeTabs.Trigger.Label>My Bar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="collection" hidden={off('collection')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.collection} renderingMode="template" />
          <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile" hidden={off('profile')}>
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.profile} renderingMode="template" />
          <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {/* A button, not a page: disabled, so a press never selects it, only tells us. */}
        <NativeTabs.Trigger
          name="new"
          hidden={off('new')}
          disabled
          accessibilityLabel="New: drink, ingredient, beer, wine, menu, bring something in, or a draft"
          listeners={{ tabPress: () => setCreating(true) }}
        >
          <NativeTabs.Trigger.Icon src={NEW_TAB_IMAGE} renderingMode="template" />
          <NativeTabs.Trigger.Label>New</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {/* iOS 27 only moves the search field into the tab bar for a real
            UISearchTab that activates search when picked (react-native-screens
            4.29+). expo-router forwards role="search" only as the legacy system
            item, so the screen props ask for the search tab directly.
            ponytail: drop unstable_nativeProps once expo-router forwards them
            (expo/expo#51876). */}
        <NativeTabs.Trigger name="search" role="search" unstable_nativeProps={{ ios: { role: 'search', automaticallyActivatesSearch: true } }}>
          {/* iOS draws the system magnifying glass from role="search" (the search
              tab's look is the system's); Android has no search role, so it takes ours. */}
          <NativeTabs.Trigger.Icon src={TAB_IMAGES.search} renderingMode="template" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      {creating ? <CreateSheet visible onClose={() => setCreating(false)} /> : null}
    </>
  );
}
