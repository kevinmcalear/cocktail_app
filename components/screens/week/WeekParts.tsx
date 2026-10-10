import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, palateHues, radius, space } from '@/constants/tokens';
import { itemHref } from '@/lib/itemRoutes';
import { detailLine, dotShape, dotTone, itemDay, kindLabel, shortDay, type WeekItem } from '@/lib/week';

const DOT = 8;

/** The colour beside an item: the guest's, a tasting's, the venue accent, or quiet for a drink. Always next to its word. */
export function useDotColor() {
  const ds = useDs();
  const hues = palateHues[ds.scheme];
  return (item: WeekItem) => ({ guest: hues.body, tasting: hues.green, accent: ds.accentText, muted: ds.c.muted })[dotTone(item)];
}

export function WeekDot({ item, size = DOT }: { item: WeekItem; size?: number }) {
  const color = useDotColor()(item);
  const shape = dotShape(item);
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'square' ? 2 : radius.pill,
        backgroundColor: shape === 'ring' ? 'transparent' : color,
        borderWidth: shape === 'ring' ? 1.5 : 0,
        borderColor: color,
      }}
    />
  );
}

/** Where an item opens: an event its page, a menu its menu, a drink its drink page; guests go to the bar for its menus. */
export function weekHref(item: WeekItem, member: boolean): Href {
  if (item.kind === 'event') return `/e/${item.id}` as Href;
  if (item.kind === 'drink') return itemHref('Cocktail', item.id) as Href;
  if (item.kind === 'menu' && !member && item.barProfileId) return `/p/${item.barProfileId}` as Href;
  return `/menus/${item.menuId ?? item.id}` as Href;
}

/**
 * One line of the week: the day on the left (or the time when the list is a
 * single day), the name, and its kind with the detail under it. `bar` adds the
 * bar's name, for the week at home.
 */
export function WeekLine({ item, from, member, bar, lead }: { item: WeekItem; from: Date; member: boolean; bar?: boolean; lead?: 'day' | 'none' }) {
  const ds = useDs();
  const router = useRouter();
  const day = shortDay(itemDay(item), from);
  const detail = [kindLabel(item), bar && item.barName ? item.barName : null, detailLine(item)].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${item.name}. ${day}. ${detail}`}
      onPress={() => router.push(weekHref(item, member))}
      style={[styles.line, { borderBottomColor: ds.c.line }]}
    >
      {lead === 'none' ? null : (
        <DsText variant="caption" tone="muted" style={styles.day}>
          {day}
        </DsText>
      )}
      <WeekDot item={item} />
      <View style={styles.flex}>
        <DsText numberOfLines={2}>{item.name}</DsText>
        <Caption tone="muted" numberOfLines={2}>
          {detail}
        </Caption>
      </View>
    </PressableScale>
  );
}

/** The week's seven days in a row, each with a dot per thing on it. Today carries the accent. */
export function WeekRibbon({ days, today, onPick, picked }: { days: { day: string; items: WeekItem[] }[]; today: string; picked?: string; onPick?: (day: string) => void }) {
  const ds = useDs();
  return (
    <View role="list" style={styles.ribbon}>
      {days.map(({ day, items }) => {
        const [y, m, d] = day.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const isToday = day === today;
        const label = `${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}${isToday ? ', today' : ''}: ${
          items.length ? items.map((i) => `${kindLabel(i)}, ${i.name}`).join('; ') : 'nothing on'
        }`;
        return (
          <PressableScale
            key={day}
            role="listitem"
            accessibilityLabel={label}
            disabled={!onPick}
            onPress={() => onPick?.(day)}
            style={[styles.cell, (picked ?? today) === day && { backgroundColor: ds.c.raised }]}
          >
            <Caption color={isToday ? ds.accentText : ds.c.muted}>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</Caption>
            <DsText variant="spec" style={isToday ? { fontFamily: fontFamilies.monoMedium } : null}>
              {d}
            </DsText>
            <View style={styles.dots}>
              {items.slice(0, 3).map((i) => (
                <WeekDot key={`${i.kind}-${i.id}`} item={i} size={6} />
              ))}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  day: { width: 64, fontFamily: fontFamilies.mono },
  flex: { flex: 1, minWidth: 0 },
  ribbon: { flexDirection: 'row', gap: space.xs },
  cell: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.sm, borderRadius: radius.control, minHeight: 64 },
  dots: { flexDirection: 'row', gap: 2, height: 6 },
});
