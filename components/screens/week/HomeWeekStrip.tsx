import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useMyWeek, useWeekStart } from '@/hooks/useWeek';
import { detailLine, itemDay, kindLabel, shortDay, timeLine, upcoming, type WeekItem } from '@/lib/week';

import { useDotColor, weekHref } from './WeekParts';

/** How many cards the strip holds before "All" takes over. */
const SHOWN = 6;

/**
 * Discover at home: what's on this week at the bars you love, and your own
 * dated home menus, as a row of cards. Nothing on (or nothing loved yet):
 * nothing shown.
 */
export function HomeWeekStrip() {
  const router = useRouter();
  const from = useWeekStart();
  const { data = [] } = useMyWeek();
  const on = upcoming(data, from).slice(0, SHOWN);
  if (!on.length) return null;
  return (
    <View role="region" accessibilityLabel="This week, at bars you love" style={styles.section}>
      <View style={styles.head}>
        <DsText variant="caption" tone="muted" style={styles.caps}>
          This week, at bars you love
        </DsText>
        <TextLink label="All" accessibilityHint="Opens the week" onPress={() => router.push('/week')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {on.map((item, i) => (
          <WeekCard key={`${item.kind}-${item.id}`} item={item} from={from} wide={i === 0 && item.kind === 'event'} />
        ))}
      </ScrollView>
    </View>
  );
}

function WeekCard({ item, from, wide }: { item: WeekItem; from: Date; wide: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const color = useDotColor()(item);
  const day = shortDay(itemDay(item), from);
  const when = [day === 'Today' && item.kind === 'event' ? 'Tonight' : day, item.kind === 'event' ? timeLine(item)?.split(' to ')[0] : kindLabel(item).toLowerCase()]
    .filter(Boolean)
    .join(' · ');
  const detail = [item.kind === 'home_menu' ? null : item.barName, detailLine(item)].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${kindLabel(item)}: ${item.name}. ${when}. ${detail}`}
      onPress={() => router.push(weekHref(item, false))}
      style={[styles.card, { width: wide ? 260 : 200, backgroundColor: ds.c.surface, borderColor: wide ? color : ds.c.line }]}
    >
      <Caption color={day === 'Today' ? ds.accentText : ds.c.muted}>{when}</Caption>
      <DsText numberOfLines={2} variant={wide ? 'headline' : 'body'}>
        {item.name}
      </DsText>
      {detail ? (
        <Caption tone="muted" numberOfLines={2}>
          {detail}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { gap: space.sm },
  card: { gap: space.xs, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
});
