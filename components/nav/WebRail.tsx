import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { WEB_RAIL_WIDTH } from '@/hooks/useIsWideWeb';
import { currentProps } from '@/lib/a11yState';
import { withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';
import { footerLine, shortPersonName } from '@/lib/shellNav';

import { useNavPlaces, type Place } from './navPlaces';
import { VenueSwitcher } from './VenueSwitcher';
import { TabIcon } from './WebTabBar';
import type { SideNavProps } from './WebSideNav';

function RailItem({ place, current, onPress }: { place: Place; current: boolean; onPress: () => void }) {
  const ds = useDs();
  const color = current ? ds.accentText : ds.c.muted;
  return (
    <PressableScale
      role="link"
      {...currentProps(current)}
      accessibilityLabel={place.label}
      onPress={onPress}
      style={[styles.item, current && { backgroundColor: withAlpha(ds.accentText, 0.16) }]}
    >
      <View style={styles.icon}>
        <TabIcon name={place.icon} size={20} color={color} />
      </View>
      <DsText variant="caption" color={color} numberOfLines={1} align="center" style={[styles.label, current && styles.strong]}>
        {place.label}
      </DsText>
    </PressableScale>
  );
}

/**
 * The tablet rail (768 to 1199 wide), as canvas board nav-tablet draws it:
 * the logo (the venue menu, as on a phone), Search, the tabs with labels,
 * Menus and Back bar at a venue, New (an outlined circle), and you at the
 * foot. The page beside it gets the rest of the width.
 */
export function WebRail({ current, go, searching, onSearch, onNew }: SideNavProps) {
  const ds = useDs();
  const router = useRouter();
  const { venue, tabs, work } = useNavPlaces();
  const name = shortPersonName(useUserDisplayName());
  const line = footerLine(venue ? { name: venue.name, role: roleLabel(venue.roleLevel) } : null, null);
  return (
    <View role="navigation" accessibilityLabel="Main" style={[styles.rail, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line }]}>
      {/* The mark sits on the rail's centre line, its chevron hanging to the right (canvas shell n4). */}
      <View style={styles.mark}>
        <VenueSwitcher size={36} />
      </View>
      <View style={styles.search}>
        <GlassButton icon="magnifyingglass" accessibilityLabel="Search" color={searching ? ds.accentText : undefined} onPress={onSearch} />
      </View>
      <View style={styles.items}>
        {[...tabs, ...work].map((p) => (
          <RailItem key={p.key} place={p} current={current === p.key} onPress={() => go(p)} />
        ))}
      </View>
      <PressableScale accessibilityLabel="New" onPress={onNew} style={[styles.new, { borderColor: ds.c.lineStrong }]}>
        <IconSymbol name="plus" size={18} color={ds.c.ink} />
      </PressableScale>
      <PressableScale
        role="link"
        accessibilityLabel={`You: ${name}, ${line}`}
        onPress={() => (venue ? router.push('/you') : router.navigate('/profile'))}
        style={styles.you}
      >
        <CurrentUserAvatar size={32} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: WEB_RAIL_WIDTH, height: '100%', flexShrink: 0, alignItems: 'center', paddingVertical: space.lg, gap: space.xs, borderRightWidth: StyleSheet.hairlineWidth },
  // The board's chevron (12) and its gap (4): the mark itself lands on the centre line.
  mark: { marginLeft: 16 },
  search: { marginVertical: space.sm },
  items: { alignItems: 'center', gap: space.xs },
  item: { width: 64, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.control + 2 },
  // The board's 22 box draws a smaller glyph than Feather's: a 20 Feather icon matches its size and stroke.
  icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  // The board sets these 13/16 with no tracking, so a semibold Collection still fits the 64.
  label: { lineHeight: 16, letterSpacing: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  new: { width: layout.minTapTarget, height: layout.minTapTarget, marginTop: space.sm, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  you: { marginTop: 'auto', minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
