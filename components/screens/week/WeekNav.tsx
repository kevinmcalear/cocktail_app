import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useBarWeek, useMyWeek, useWeekStart } from '@/hooks/useWeek';
import { currentProps } from '@/lib/a11yState';
import { withAlpha } from '@/lib/color';
import { itemDay, kindLabel, shortDay, upcoming, type WeekItem } from '@/lib/week';

import { WeekDot, weekHref } from './WeekParts';

/** How many of the week's things the sidebar lists before "This week" says the rest. */
const SHOWN = 5;

/**
 * The sidebar's This week: its heading opens the week page, and the next few
 * things on (events, menus going on, home menus) open their own pages. Venue
 * mode reads the venue's week; home mode the bars you love and your menus.
 */
export function WeekNav() {
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const venue = useBarWeek(mode === 'venue' ? active?.id : null);
  const home = useMyWeek();
  const items = (mode === 'venue' ? venue.data : home.data) ?? [];
  return <WeekNavList items={items} member={mode === 'venue'} />;
}

function WeekNavList({ items, member }: { items: WeekItem[]; member: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const pathname = usePathname();
  const from = useWeekStart();
  const on = upcoming(items, from);
  const current = pathname === '/week';
  return (
    <View style={styles.section}>
      <PressableScale
        role="link"
        {...currentProps(current)}
        accessibilityLabel={`This week, ${on.length} on`}
        onPress={() => router.navigate('/week')}
        style={[styles.heading, current && { backgroundColor: withAlpha(ds.accentText, 0.16) }]}
      >
        <DsText variant="caption" color={current ? ds.c.ink : ds.c.muted} style={styles.headingLabel}>
          This week
        </DsText>
        {on.length ? (
          <DsText variant="caption" tone="muted">
            {on.length}
          </DsText>
        ) : null}
      </PressableScale>
      {on.length === 0 ? (
        <DsText variant="caption" tone="muted" style={styles.empty}>
          Nothing on yet
        </DsText>
      ) : null}
      {on.slice(0, SHOWN).map((item) => {
        const day = shortDay(itemDay(item), from);
        return (
          <PressableScale
            key={`${item.kind}-${item.id}`}
            role="link"
            accessibilityLabel={`${kindLabel(item)}: ${item.name}, ${day}`}
            onPress={() => router.push(weekHref(item, member))}
            style={styles.row}
          >
            <View style={styles.dot}>
              <WeekDot item={item} />
            </View>
            <DsText numberOfLines={1} style={styles.name}>
              {item.name}
            </DsText>
            <DsText variant="caption" color={day === 'Today' ? ds.accentText : ds.c.muted}>
              {day}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg, gap: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.control },
  headingLabel: { fontFamily: fontFamilies.monoMedium, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.control },
  dot: { width: 18, alignItems: 'center' },
  name: { flex: 1, minWidth: 0 },
});
