import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, GlassSurface, useDs, type IconName } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import type { BrandLook } from '../BrandPreview';

const GROUPS: { title: string; rows: { title: string; detail: string; icon: IconName }[] }[] = [
  {
    title: 'Tonight',
    rows: [
      { title: 'Autumn menu', detail: '4 drinks · 2 changed this week', icon: 'place.menus' },
      { title: 'Prep', detail: '3 batches due before doors', icon: 'place.prep' },
    ],
  },
  {
    title: 'Team',
    rows: [
      { title: 'On shift', detail: 'Ana, Theo and Sam', icon: 'place.team' },
      { title: 'Specs to learn', detail: '2 new this week', icon: 'checkmark' },
    ],
  },
];
const TABS: { label: string; icon: IconName }[] = [
  { label: 'Bar', icon: 'building.2' },
  { label: 'Menus', icon: 'place.menus' },
  { label: 'Prep', icon: 'place.prep' },
  { label: 'Me', icon: 'person' },
];

/**
 * The staff phone in the draft theme (canvas Theme-rye-staff: "their whole
 * app wears it"): the bar's mark and name in its face, tonight's and the
 * team's rows with their icons in its colour. Controls stay the app's.
 */
export function StaffPage({ look, top }: { look: BrandLook; top: number }) {
  const ds = useDs();
  return (
    <View style={[styles.page, { paddingTop: top + space.xxl }]}>
      <View style={styles.head}>
        <View style={styles.row}>
          <VenueMark venue={{ ...look, roleLevel: 40 }} size={30} />
          <Body tone="muted">Thursday · doors at 6</Body>
        </View>
        <DsText variant="title" numberOfLines={2}>{look.name}</DsText>
      </View>
      {GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Caption tone="muted" style={styles.groupHead}>{g.title}</Caption>
          <View style={[styles.card, { backgroundColor: ds.c.surface }]}>
            {g.rows.map((r, i) => (
              <View key={r.title} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: ds.c.line }]}>
                <View style={[styles.icon, { backgroundColor: withAlpha(ds.accentText, 0.12) }]}>
                  <IconSymbol name={r.icon} size={16} color={ds.accentText} />
                </View>
                <View style={styles.flex}>
                  <Body>{r.title}</Body>
                  <Caption tone="muted">{r.detail}</Caption>
                </View>
                <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** The staff phone's tab bar: glass, Bar chosen in the bar's colour (Theme-rye-staff). */
export function StaffTabs() {
  const ds = useDs();
  return (
    <GlassSurface style={styles.tabs}>
      {TABS.map((t, i) => (
        <View key={t.label} aria-current={i === 0 ? 'page' : undefined} style={[styles.tab, i === 0 && { backgroundColor: ds.scheme === 'dark' ? ds.c.raised : ds.c.surface }]}>
          <IconSymbol name={t.icon} size={20} color={i === 0 ? ds.accentText : ds.c.muted} />
          <Caption color={i === 0 ? ds.accentText : ds.c.muted} style={styles.strong}>{t.label}</Caption>
        </View>
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xl, paddingHorizontal: space.lg, paddingBottom: space.xxxl * 3 },
  head: { gap: space.sm, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  group: { gap: space.sm },
  groupHead: { paddingHorizontal: space.lg },
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  icon: { width: 30, height: 30, borderRadius: radius.mark * 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { ...font.semiBold },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 62, paddingHorizontal: space.xs + 2, borderRadius: radius.pill },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: layout.minTapTarget + space.lg, height: 52, borderRadius: radius.pill },
});
