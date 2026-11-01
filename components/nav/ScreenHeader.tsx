import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Display, GlassButton, PressableScale, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useOpenSearch } from '@/hooks/useSearchFrom';

import { VenueDeleteBanner } from '@/components/screens/venue/DeleteVenue';

import { AddButton, DeskAddButton } from './AddButton';
import { VenueSwitcher } from './VenueSwitcher';

/**
 * The top of a tab's page on a phone (the shell, tabs A, 31 Oct 2026): the
 * place button (switch between your bars and home) with the page's title
 * beside it on the left, the page's tools and the + (Add) on the right. You
 * is a tab, so there's no avatar. Android has no + here: its Add is the
 * plain FAB (AddButton.tsx), and its top row is the search bar, "Search
 * or add anything", with the place button at its end; the title sits under it.
 *
 * `back`: a page pushed on a tab (Prep, Study) gets a back button in the
 * place button's spot and no +.
 *
 * Wide web has the place button, New and you in the side nav: the title (at
 * display size with `display`) and `actions` share one line, or the row is
 * just the space above the page's own title. From 1200 (a desktop), "+ Add"
 * ends that row wherever a phone shows its + (DeskAddButton).
 *
 * `center` (phones) fills the middle of the row, between the place button
 * and the +, and the title becomes a heading only screen readers hear
 * (Discover's search pill). `add={false}`: the + steps aside, so the middle
 * has the room (Discover's pill while it holds a search).
 */
export function ScreenHeader({ title, display, actions, center, add = true, back }: { title?: string; display?: boolean; actions?: ReactNode; center?: ReactNode; add?: boolean; back?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  // The breakpoint, not the nav: Drinks' list beside a drink lays out as a tablet's, so it leaves Add to the page.
  const desk = useBreakpoint() === 'desktop';
  // A venue's delete waiting its 7 days shows under every venue screen's header (E53).
  const banner = <VenueDeleteBanner />;
  if (wide) {
    const plus = add && !back && desk ? <DeskAddButton /> : null;
    // insets.top: an iPad's status bar (0 on the web).
    if (!title && !actions && !plus)
      return (
        <>
          <View style={[styles.wide, { marginTop: insets.top }]} />
          {banner}
        </>
      );
    return (
      <>
        <View style={[styles.row, styles.wideTitled, { paddingHorizontal: gutter, marginTop: insets.top }]}>
          {!title ? <View /> : display ? <Display aria-level={1}>{title}</Display> : <Title aria-level={1}>{title}</Title>}
          <View style={styles.end}>
            {actions}
            {plus}
          </View>
        </View>
        {banner}
      </>
    );
  }
  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const start = back ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={goBack} /> : <VenueSwitcher />;
  const heading = title ? (
    <Title aria-level={1} numberOfLines={1} style={center ? styles.readerOnly : styles.title}>
      {title}
    </Title>
  ) : null;
  if (Platform.OS === 'android' && !center) {
    return (
      <>
        <View style={[styles.android, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
          <View style={styles.row}>
            {back ? start : null}
            <SearchBar end={back ? null : start} />
          </View>
          {heading || actions ? (
            <View style={styles.row}>
              {heading ?? <View />}
              <View style={styles.end}>{actions}</View>
            </View>
          ) : null}
        </View>
        {banner}
      </>
    );
  }
  return (
    <>
      <View style={[styles.row, center ? styles.tight : null, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <View style={styles.start}>
          {start}
          {center ? null : heading}
        </View>
        {center ? (
          <View style={styles.center}>
            {heading}
            {center}
          </View>
        ) : null}
        <View style={styles.end}>
          {actions}
          {add && !back && Platform.OS !== 'android' ? <AddButton /> : null}
        </View>
      </View>
      {banner}
    </>
  );
}

/** Android's top search bar: a Material 3 search bar that opens the one search, with the place button at its end. */
function SearchBar({ end }: { end: ReactNode }) {
  const ds = useDs();
  const openSearch = useOpenSearch();
  return (
    <View style={[styles.search, { backgroundColor: ds.c.raised }]}>
      <PressableScale role="button" accessibilityLabel="Search or add anything" onPress={() => openSearch()} style={styles.searchField}>
        <IconSymbol name="magnifyingglass" size={20} color={ds.c.muted} />
        <Body tone="muted" numberOfLines={1}>
          Search or add anything
        </Body>
      </PressableScale>
      {end}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  // A pill in the middle (Discover's) gets the room: the board's 8 between it, the logo and you.
  tight: { gap: space.sm },
  // Wide web: the space above the title, where a phone has the logo row.
  wide: { height: space.xl },
  wideTitled: { minHeight: space.xxl + space.md, paddingTop: space.md },
  start: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  title: { flexShrink: 1 },
  center: { flex: 1, minWidth: 0 },
  // In the reading order, off the screen.
  readerOnly: { position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  android: { gap: space.md },
  // Material 3's search bar: 56 tall, a full pill.
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: space.lg, paddingRight: space.xs, borderRadius: radius.pill },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
});

/**
 * The header inside a list: ScreenHeader handles its own safe-area padding and
 * gutter, so this cancels the list's horizontal padding around it.
 */
export function ScreenHeaderSpacer(props: { title?: string; actions?: ReactNode; add?: boolean; back?: boolean }) {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader {...props} />
    </View>
  );
}
