import { NativeTabs } from 'expo-router/native-tabs';
import type { SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { useDs } from '@/components/ds';
import { useMode } from '@/hooks/useMode';
import { useServiceDay } from '@/hooks/useServiceDay';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { PHONE_TAB_LIMIT, venueTabs, type VenueTab } from '@/lib/venueFeatures';

import { calendarDayImage, hasNumberedCalendarSymbols } from './tabCalendar';
import { VenueBrandProvider } from './VenueBrandProvider';

/**
 * Redesigned tabs on iOS and Android: the system tab bar (Liquid Glass on
 * iOS 26+, Material 3 on Android), tinted with the venue's accent. Web uses
 * AppTabs.web.tsx. Venue mode: Library, Menus, Discover, plus Tonight, Prep
 * and Study when the venue switched them on (lib/venueFeatures.ts). Home
 * mode: Discover, My Bar, Collection, You. Tonight is a calendar page
 * showing the date, which turns over at 6am.
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
  const { mode, ready } = useMode();
  const features = useVenueFeatures();
  const home = mode === 'home';
  const day = useServiceDay() ?? 1;
  // Venue and home have different tabs, and switching remounts them all:
  // wait for the mode (a moment, on a first launch) and the venue's switches
  // rather than open the wrong set.
  if (!ready || !features.ready) return <View style={{ flex: 1, backgroundColor: ds.c.ground }} />;
  const shown = home ? [] : venueTabs(features.has, PHONE_TAB_LIMIT);
  const off = (name: VenueTab) => home || !shown.includes(name);
  // Discover is in both modes. The rest swap, the way an account switch swaps
  // an app's tabs; home mode's index redirects to Discover. Android's Material
  // bar hides unselected labels past three tabs; "labeled" keeps every tab named.
  return (
    <NativeTabs tintColor={ds.accentText} minimizeBehavior="onScrollDown" labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index" hidden={off('index')}>
        {/* No filled variant of a dated calendar: the tint marks the selected tab. */}
        <NativeTabs.Trigger.Icon
          sf={hasNumberedCalendarSymbols ? (`${day}.calendar` as SFSymbol) : undefined}
          src={calendarDayImage(day)}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Tonight</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" hidden={off('library')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menus" hidden={off('menus')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} md="restaurant_menu" />
        <NativeTabs.Trigger.Label>Menus</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="prep" hidden={off('prep')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'flask', selected: 'flask.fill' }} md="science" />
        <NativeTabs.Trigger.Label>Prep</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="test" hidden={off('test')}>
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
      <NativeTabs.Trigger name="search" role="search">
        {/* iOS draws the system magnifying glass from role="search" and ignores
            md; Android has no search role, so without this the tab is blank. */}
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
