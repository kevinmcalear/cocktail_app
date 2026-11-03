import { Stack, useRouter } from 'expo-router';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import type { NativeStackNavigationOptions } from 'expo-router/native-stack';
import { use, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Display, DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { VenueDeleteBanner } from '@/components/screens/venue/VenueDeleteBannerLazy';
import { font, layout, space } from '@/constants/tokens';

import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { useTabBarInset } from './WebTabBar';

/**
 * The header of a page pushed on a stack (Prep, Study), as the Product page
 * draws its pushed pages (2027 canvas, Prod-phone's top bar): Back on the left,
 * the page's tools on the right, and the page's own big title in the page,
 * whose small twin comes into the bar once the big one has scrolled under it.
 * - iOS: the system's navigation bar, floating over the page (Liquid Glass Back).
 * - Android: its own Material 3 top app bar, arrow_back on the left; it fills
 *   with the tonal surface once the page scrolls.
 * - Phone web: the same row drawn here, a glass Back circle and the title
 *   centred. Wide screens have none: the sidebar stands in for Back.
 *
 * To opt a page in:
 * 1. Its stack keeps `headerShown: false` by default; the page renders
 *    `<NativeHeader title="Prep" scroll={scroll} actions={…} />` anywhere in its
 *    tree. It sets its own screen's header (Stack.Screen), so it works on any
 *    native stack: a tab's (app/(tabs)/(1-tonight,2-drinks,3-discover,4-you))
 *    or the root one.
 * 2. Its scroll view takes `const scroll = useHeaderScroll()`: `{...scroll.props}`,
 *    and `scroll.bottom` under its last row. On iOS the bar floats, so the
 *    scroll view is inset for the bar and the tab bar by the system.
 * 3. It draws its own big title (`<NativeTitle title="Prep" />`) at the top of
 *    the scroll. Without `scroll` the bar shows the title all the time.
 * The drink page adopts the same way (its lane): `title` is the drink's name.
 */
export function NativeHeader({ title, actions, scroll }: { title: string; actions?: ReactNode; scroll?: HeaderScroll }) {
  const ds = useDs();
  const wide = useIsWideWeb();
  const shown = scroll ? scroll.past : true;
  const right = actions ? () => actions : undefined;
  // Wide screens (wide web, and an iPad wide enough for the sidebar) have no bar: the sidebar stands in for Back.
  const options: NativeStackNavigationOptions = wide ? { headerShown: false, title } : Platform.select<NativeStackNavigationOptions>({
    ios: {
      headerShown: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerTintColor: ds.c.ink,
      headerTitleStyle: { color: ds.c.ink },
      title: shown ? title : '',
      headerRight: right,
    },
    android: {
      headerShown: true,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: scroll?.scrolled ? ds.c.surface : ds.c.ground },
      headerTintColor: ds.c.ink,
      headerTitleStyle: { color: ds.c.ink },
      title: shown ? title : '',
      headerRight: right,
    },
    default: { headerShown: true, title, header: () => <WebBar title={title} shown={shown} actions={actions} /> },
  });
  return <Stack.Screen options={options} />;
}

/**
 * The page's own big title, first in its scroll under NativeHeader, with the
 * venue's delete banner under it as every venue screen has (E53). Wide screens
 * have no bar, so the title keeps the room ScreenHeader's wide row gave it.
 */
export function NativeTitle({ title }: { title: string }) {
  const wide = useIsWideWeb();
  // insets.top: an iPad's status bar (0 on the web).
  const top = useSafeAreaInsets().top;
  return (
    <>
      <Display aria-level={1} style={wide ? { marginTop: top + space.md } : undefined}>
        {title}
      </Display>
      <VenueDeleteBanner inline />
    </>
  );
}

/** The web's row: Back, the small title once the big one has gone, the page's tools. */
function WebBar({ title, shown, actions }: { title: string; shown: boolean; actions?: ReactNode }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const top = useSafeAreaInsets().top;
  // A page opened cold has its tab's first page under it (the stack's anchor); with nothing at all, Tonight.
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  return (
    <View style={[styles.bar, { paddingTop: top + space.sm, paddingHorizontal: gutter, backgroundColor: ds.c.ground }]}>
      <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
      {/* The page's own title is its heading; this twin is only there to read while it's scrolled away. */}
      <DsText numberOfLines={1} aria-hidden style={[styles.title, !shown && styles.hidden]}>
        {title}
      </DsText>
      <View style={styles.end}>{actions}</View>
    </View>
  );
}

/** How far a page scrolls before its big title has gone under the bar: a Display line (64) and the space over it. */
const TITLE_GONE = space.xxxl + space.xl;

export interface HeaderScroll {
  /** The page has moved: Android's bar fills with the tonal surface. */
  scrolled: boolean;
  /** The page's big title has gone under the bar, so the bar shows the small one. */
  past: boolean;
  /** For the page's ScrollView or FlatList. */
  props: {
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    contentInsetAdjustmentBehavior: 'automatic';
  };
  /** Room under the last row: the tab bar on Android and the web (iOS insets the page for its own). */
  bottom: number;
}

/** A page's scroll under NativeHeader: where it is, and what its scroll view needs. */
export function useHeaderScroll(): HeaderScroll {
  const tabBar = useTabBarInset();
  // iOS's floating bar starts the page's offset at minus its height.
  const header = use(HeaderHeightContext) ?? 0;
  const lift = Platform.OS === 'ios' ? header : 0;
  const [at, setAt] = useState({ scrolled: false, past: false });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + lift;
    const next = { scrolled: y > 1, past: y > TITLE_GONE };
    if (next.scrolled !== at.scrolled || next.past !== at.past) setAt(next);
  };
  return {
    ...at,
    props: { onScroll, scrollEventThrottle: 16, contentInsetAdjustmentBehavior: 'automatic' },
    bottom: Platform.OS === 'ios' ? space.lg : tabBar,
  };
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  // Centred between Back and the tools, as the board draws it.
  title: { ...font.semiBold, flex: 1, textAlign: 'center' },
  hidden: { opacity: 0 },
  // As wide as Back, so the title sits in the middle of the row.
  end: { minWidth: layout.minTapTarget, flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
