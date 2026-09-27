import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useDs } from '@/components/ds';
import { useMode } from '@/hooks/useMode';

import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * Redesigned tabs on iOS and Android: the system tab bar (Liquid Glass on
 * iOS 26+, Material 3 on Android), tinted with the venue's accent. Web uses
 * AppTabs.web.tsx. Venue mode: Tonight, Library, Prep, Study. Home mode:
 * Discover, My Bar, Collection, You. Menus stay a route, opened from Tonight
 * and Library.
 */
export function AppTabs() {
  return (
    <VenueBrandProvider>
      <Tabs />
    </VenueBrandProvider>
  );
}

function Tabs() {
  const ds = useDs();
  const home = useMode().mode === 'home';
  // Both modes share the first tab (Tonight or Discover). The rest swap, the
  // way an account switch swaps an app's tabs.
  return (
    <NativeTabs tintColor={ds.accentText} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        {home ? (
          <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
        ) : (
          <NativeTabs.Trigger.Icon sf={{ default: 'moon.stars', selected: 'moon.stars.fill' }} md="nightlife" />
        )}
        <NativeTabs.Trigger.Label>{home ? 'Discover' : 'Tonight'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" hidden={home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="prep" hidden={home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'flask', selected: 'flask.fill' }} md="science" />
        <NativeTabs.Trigger.Label>Prep</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="test" hidden={home}>
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} md="style" />
        <NativeTabs.Trigger.Label>Study</NativeTabs.Trigger.Label>
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
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
