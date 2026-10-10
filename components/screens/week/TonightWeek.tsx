import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, TextLink, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useBarWeek, useWeekStart } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { byDay, kindLabel, timeLine, upcoming, type WeekItem } from '@/lib/week';

import { useDotColor, WeekLine, WeekRibbon } from './WeekParts';

/** How many of the coming days' things sit under the ribbon. */
const NEXT = 3;

/**
 * Tonight's slice of the week: a card for an event on tonight, then the seven
 * days with their dots and the next few things, and the way to the week page.
 */
export function TonightWeek({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const from = useWeekStart();
  const { data: items = [] } = useBarWeek(barId);
  const today = toDay(from);
  const days = byDay(items, from);
  const tonight = days[0].items.filter((i) => i.kind === 'event');
  const later = upcoming(items, from).filter((i) => !tonight.includes(i)).slice(0, NEXT);
  return (
    <View style={styles.wrap}>
      {tonight.map((event) => (
        <TonightEvent key={event.id} event={event} />
      ))}
      <View style={styles.head}>
        <DsText variant="caption" tone="muted" style={styles.caps}>
          This week
        </DsText>
        <TextLink label="See the week" onPress={() => router.push('/week')} />
      </View>
      <WeekRibbon days={days} today={today} />
      {later.length ? (
        <View>
          {later.map((item) => (
            <WeekLine key={`${item.kind}-${item.id}`} item={item} from={from} member />
          ))}
        </View>
      ) : (
        <Caption tone="muted">Nothing else on this week. Add a takeover, a tasting or a guest shift from the week page.</Caption>
      )}
      <View style={[styles.rule, { backgroundColor: ds.c.line }]} />
    </View>
  );
}

function TonightEvent({ event }: { event: WeekItem }) {
  const ds = useDs();
  const router = useRouter();
  const color = useDotColor()(event);
  const time = timeLine(event);
  const lines = [
    event.drinkCount ? `${event.drinkCount} ${event.drinkCount === 1 ? 'drink' : 'drinks'} on the event menu` : null,
    event.houseMenuOn === false ? 'House menu off tonight' : 'House menu still on',
    event.isPublic ? null : 'Team only',
  ].filter(Boolean);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${kindLabel(event)} tonight: ${event.name}. ${time ?? ''}. ${lines.join('. ')}`}
      onPress={() => router.push(`/e/${event.id}` as Href)}
      style={[styles.card, { backgroundColor: ds.c.surface, borderColor: color }]}
    >
      <Caption color={color}>{[`${kindLabel(event)} tonight`, time].filter(Boolean).join(' · ')}</Caption>
      <Title>{event.name}</Title>
      <Caption tone="muted">{[event.guestName, ...lines].filter(Boolean).join('. ')}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: space.sm },
});
