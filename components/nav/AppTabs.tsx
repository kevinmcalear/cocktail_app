import { NativeTabs } from 'expo-router/native-tabs';
import { View } from 'react-native';

import { useDs } from '@/components/ds';
import { FEATURES } from '@/constants/features';
import { useMode } from '@/hooks/useMode';

import { EightBallProvider } from '@/components/screens/eightball/EightBallProvider';

import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * Redesigned tabs on iOS and Android: the system tab bar (Liquid Glass on
 * iOS 26+, Material 3 on Android), tinted with the venue's accent. Web uses
 * AppTabs.web.tsx. Venue mode: Tonight, Library, Discover. Home mode:
 * Discover, My Bar, Collection, You. Prep and Study are switched off in
 * constants/features.ts. Menus stay a route, opened from Tonight and Library.
 */
export function AppTabs() {
  return (
    <VenueBrandProvider>
      <EightBallProvider>
        <Tabs />
      </EightBallProvider>
    </VenueBrandProvider>
  );
}

function Tabs() {
  const ds = useDs();
  const { mode, ready } = useMode();
  const home = mode === 'home';
  // Venue and home have different tabs, and switching remounts them all:
  // wait for the mode (a moment, on a first launch) rather than open the wrong set.
  if (!ready) return <View style={{ flex: 1, backgroundColor: ds.c.ground }} />;
  // Discover is in both modes. The rest swap, the way an account switch swaps
  // an app's tabs; home mode's index redirects to Discover. Android's Material
  // bar hides unselected labels past three tabs; "labeled" keeps every tab named.
  return (
    <NativeTabs tintColor={ds.accentText} minimizeBehavior="onScrollDown" labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index" hidden={home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'moon.stars', selected: 'moon.stars.fill' }} md="nightlife" />
        <NativeTabs.Trigger.Label>Tonight</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" hidden={home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="prep" hidden={home || !FEATURES.prep}>
        <NativeTabs.Trigger.Icon sf={{ default: 'flask', selected: 'flask.fill' }} md="science" />
        <NativeTabs.Trigger.Label>Prep</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="test" hidden={home || !FEATURES.study}>
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} md="style" />
        <NativeTabs.Trigger.Label>Study</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bar" hidden={!home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'wineglass', selected: 'wineglass.fill' }} md="wine_bar" />
        <NativeTabs.Trigger.Label>My Bar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="collection" hidden={!home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmark" />
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" hidden={!home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menus" hidden />
      <NativeTabs.Trigger name="search" role="search">
        {/* iOS draws the system magnifying glass from role="search" and ignores
            md; Android has no search role, so without this the tab is blank. */}
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
