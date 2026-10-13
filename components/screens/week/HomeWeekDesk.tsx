import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, PressableScale, Title, useDs } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, palateHues, radius, space } from '@/constants/tokens';
import { useBarDrinks } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import { dayHeading, detailLine, itemDay, kindLabel, shortDay, timeLine, type WeekItem } from '@/lib/week';
import { siteOrigin } from '@/lib/venueLink';

import { useDotColor, weekHref } from './WeekParts';

const MARK = 44;

/**
 * This week at home on a desktop (week-home-desk): a dated agenda, each day in
 * a gutter on the left and its things to the right (a takeover as a card with
 * Add to calendar), and beside it what's new at the bars you love, with
 * whether your bar makes it. `aside`: under that list (the alerts link).
 */
export function HomeWeekDesk({ days, from, fresh, aside }: { days: { day: string; items: WeekItem[] }[]; from: Date; fresh: WeekItem[]; aside?: ReactNode }) {
  const ds = useDs();
  const on = days.filter((d) => d.items.length);
  return (
    <View style={styles.wrap}>
      <View style={styles.agenda}>
        {on.map(({ day, items }, i) => {
          const h = dayHeading(day, from);
          return (
            <View key={day} role="region" accessibilityLabel={[h.lead, h.date].filter(Boolean).join(', ')} style={[styles.day, i < on.length - 1 ? { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
              <View style={styles.gutter}>
                {h.lead ? <Caption color={ds.accentText} style={styles.semi}>{h.lead}</Caption> : null}
                <Caption tone="muted" style={styles.mono}>
                  {h.date}
                </Caption>
              </View>
              <View style={styles.items}>
                {items.map((item) => (
                  <AgendaRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      <View role="region" accessibilityLabel="New at bars you love" style={styles.aside}>
        <Eyebrow>New at bars you love</Eyebrow>
        {fresh.length ? fresh.map((d) => <NewDrink key={d.id} item={d} from={from} />) : <Caption tone="muted">Nothing new at the bars you love since Monday.</Caption>}
        {aside}
      </View>
    </View>
  );
}

/** The bar's square mark in its colour: the guest's over the host's for a takeover, a list for your own menu. */
function Marks({ item }: { item: WeekItem }) {
  const ds = useDs();
  const tile = (name: string | null, color: string | null, key: string, over?: boolean) => (
    <View key={key} style={[styles.mark, { backgroundColor: color ?? ds.c.raised }, over ? [styles.over, { borderColor: ds.c.surface }] : null]}>
      <DsText variant="headline" color={color ? ds.c.ground : ds.c.ink} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
        {(name ?? '?').slice(0, 1).toUpperCase()}
      </DsText>
    </View>
  );
  if (item.kind === 'home_menu') {
    return (
      <View style={[styles.mark, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="list.bullet" size={20} color={ds.accentText} />
      </View>
    );
  }
  if (item.eventKind === 'takeover' && item.guestName) {
    return (
      <View aria-hidden style={styles.marks}>
        {tile(item.guestName, item.guestColor, 'guest')}
        {tile(item.barName, item.barColor, 'host', true)}
      </View>
    );
  }
  if (item.eventKind === 'guest_shift' && item.guestName) {
    return <View aria-hidden>{tile(item.guestName, null, 'guest')}</View>;
  }
  return <View aria-hidden>{tile(item.barName, item.barColor, 'bar')}</View>;
}

/** One thing on a day. A takeover is a card in its own right; the rest are rows. */
function AgendaRow({ item }: { item: WeekItem }) {
  const ds = useDs();
  const router = useRouter();
  const color = useDotColor()(item);
  const takeover = item.kind === 'event' && item.eventKind === 'takeover';
  const kind =
    item.kind === 'home_menu'
      ? ['Your home menu', item.guestCount ? `${item.guestCount} guests` : null].filter(Boolean).join(' · ')
      : item.kind === 'menu'
        ? ['New menu', item.barName].filter(Boolean).join(' · ')
        : [kindLabel(item), timeLine(item)].filter(Boolean).join(' · ');
  const detail = item.kind === 'event' ? [item.barName ? `At ${item.barName}` : null, item.description].filter(Boolean).join(' · ') : detailLine(item);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[kind, item.name, detail].filter(Boolean).join('. ')}
      onPress={() => router.push(weekHref(item, false))}
      style={[styles.row, takeover ? [styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }] : null]}
    >
      <Marks item={item} />
      <View style={styles.flex}>
        <Caption color={item.kind === 'home_menu' ? ds.accentText : takeover ? color : ds.c.muted}>{kind}</Caption>
        {takeover ? <Title role={undefined}>{item.name}</Title> : <Body style={styles.name}>{item.name}</Body>}
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {item.kind === 'event' && item.isPublic ? (
        <Button label="Add to calendar" variant="secondary" onPress={() => Linking.openURL(`${siteOrigin()}/api/week-ics?event=${item.id}`)} style={styles.calendar} />
      ) : null}
    </PressableScale>
  );
}

/** A drink a bar you love added this week, and whether your bar makes it. */
function NewDrink({ item, from }: { item: WeekItem; from: Date }) {
  const ds = useDs();
  const router = useRouter();
  const bar = useBarDrinks();
  const ready = bar.canMakeIds.has(item.id);
  const away = bar.oneAway.find((g) => g.drinks.some((d) => d.id === item.id));
  const shelf = ready ? 'You have everything' : away ? `Missing ${away.bottles.map((b) => b.name).join(' and ')}` : null;
  return (
    <PressableScale role="link" accessibilityLabel={[item.name, item.barName, shelf].filter(Boolean).join('. ')} onPress={() => router.push(itemHref('Cocktail', item.id) as never)} style={[styles.drink, { borderBottomColor: ds.c.line }]}>
      <View style={styles.thumb}>
        <DrinkImage thumb sketchDetail="thumb" source={item.imageUrl} glass={item.glassKey} itemId={item.id} accessibilityLabel={item.name} radius="control" />
      </View>
      <View style={styles.flex}>
        <Body style={styles.name} numberOfLines={1}>
          {item.name}
        </Body>
        <Caption tone="muted">{[item.barName, `added ${shortDay(itemDay(item), from)}`].filter(Boolean).join(' · ')}</Caption>
        {shelf ? <Caption color={ready ? palateHues[ds.scheme].green : ds.c.muted}>{shelf}</Caption> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  agenda: { flex: 1, minWidth: 0, gap: space.xl - 4 },
  day: { flexDirection: 'row', gap: space.xl - 4, paddingBottom: space.xl - 4 },
  gutter: { width: 64 },
  items: { flex: 1, minWidth: 0, gap: space.md },
  mono: { fontFamily: fontFamilies.mono },
  semi: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2 },
  card: { padding: space.md + 2, borderRadius: radius.card - 6, borderWidth: 1, borderCurve: 'continuous' },
  marks: { flexDirection: 'row' },
  mark: { width: MARK, height: MARK, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  over: { marginLeft: -10, borderWidth: 2 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fontFamilies.bodyMedium },
  calendar: { paddingHorizontal: space.md + 2 },
  aside: { width: 300, gap: space.xs },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 48 },
});
