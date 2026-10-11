import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { layout, radius, space } from '@/constants/tokens';
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
      <TabIcon name={place.icon} size={20} color={color} />
      <DsText variant="caption" color={current ? ds.c.ink : ds.c.muted} numberOfLines={1} align="center">
        {place.label}
      </DsText>
    </PressableScale>
  );
}

/**
 * The tablet rail (768 to 1199 wide): the logo (the venue menu, as on a
 * phone), Search, the tabs with labels, Menus and Back bar at a venue, New,
 * and you at the foot. The page beside it gets the rest of the width.
 */
export function WebRail({ current, go, searching, onSearch, onNew }: SideNavProps) {
  const ds = useDs();
  const router = useRouter();
  const { venue, tabs, work } = useNavPlaces();
  const name = shortPersonName(useUserDisplayName());
  const line = footerLine(venue ? { name: venue.name, role: roleLabel(venue.roleLevel) } : null, null);
  return (
    <View role="navigation" accessibilityLabel="Main" style={[styles.rail, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line }]}>
      <VenueSwitcher size={36} />
      <GlassButton icon="magnifyingglass" accessibilityLabel="Search" color={searching ? ds.accentText : undefined} onPress={onSearch} />
      <View style={styles.items}>
        {[...tabs, ...work].map((p) => (
          <RailItem key={p.key} place={p} current={current === p.key} onPress={() => go(p)} />
        ))}
      </View>
      <GlassButton icon="plus" accessibilityLabel="New" onPress={onNew} />
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
  items: { alignItems: 'center', gap: space.xs, marginVertical: space.sm },
  item: { width: 64, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.control },
  you: { marginTop: 'auto', minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
