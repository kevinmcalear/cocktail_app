import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, TextLink, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarWeek, useWeekStart } from '@/hooks/useWeek';
import { withAlpha } from '@/lib/color';
import { toDay } from '@/lib/collection';
import { siteOrigin } from '@/lib/venueLink';
import { detailLine, itemDay, kindLabel, shortDay, timeLine, upcoming, type WeekItem } from '@/lib/week';

import { useDotColor, WeekLine } from './WeekParts';

/**
 * A bar page's This week, as its guests see it: public events, menus going on
 * and new published drinks. The bar's team sees the same public view here;
 * their whole week is on the week page. Nothing on: nothing shown.
 */
export function BarWeek({ barId, profileId, barName }: { barId: string | null; profileId: string; barName: string }) {
  const ds = useDs();
  const { on, from } = usePublicWeek(barId);
  if (!on.length) return null;
  const [first, ...rest] = on;
  const tonight = first.kind === 'event' && itemDay(first) === toDay(from) ? first : null;
  const lines = tonight ? rest : on;
  const feed = `${siteOrigin().replace(/^https?:/, 'webcal:')}/api/week-ics?bar=${profileId}`;
  return (
    <View role="region" accessibilityLabel={`This week at ${barName}`} style={styles.section}>
      <DsText variant="caption" tone="muted" style={styles.caps}>
        This week
      </DsText>
      {tonight ? <TonightCard event={tonight} /> : null}
      {lines.length ? (
        <View style={[styles.list, { backgroundColor: ds.c.surface }]}>
          {lines.map((item) => (
            <View key={`${item.kind}-${item.id}`} style={styles.line}>
              <View style={styles.flex}>
                <WeekLine item={item} from={from} member={false} dot={false} />
              </View>
              {item.ticketUrl ? <TextLink label="Tickets" onPress={() => Linking.openURL(item.ticketUrl!)} /> : null}
            </View>
          ))}
        </View>
      ) : null}
      <PressableScale role="link" accessibilityLabel={`Put ${barName}'s week in your calendar`} onPress={() => Linking.openURL(feed)} style={styles.feed}>
        <IconSymbol name="calendar" size={16} color={ds.accentText} />
        <DsText color={ds.accentText}>{`Put ${barName}'s week in your calendar`}</DsText>
      </PressableScale>
    </View>
  );
}

/** What's on at a bar from today, as its guests see it. */
function usePublicWeek(barId: string | null) {
  const from = useWeekStart();
  const { data = [] } = useBarWeek(barId);
  return { on: upcoming(data.filter((i) => i.isPublic), from), from };
}

/**
 * This week as one line on a phone's bar page (Q30 A, approved 26 Oct 2026),
 * so the drinks come sooner: "Tonight · This week, 3 things on" over the
 * first thing's name. It opens to the whole week in place.
 */
export function BarWeekLine(props: { barId: string | null; profileId: string; barName: string }) {
  const ds = useDs();
  const color = useDotColor();
  const [open, setOpen] = useState(false);
  const { on, from } = usePublicWeek(props.barId);
  if (!on.length) return null;
  if (open) return <BarWeek {...props} />;
  const first = on[0];
  const count = on.length === 1 ? 'This week, 1 thing on' : `This week, ${on.length} things on`;
  return (
    <PressableScale
      role="button"
      aria-expanded={false}
      accessibilityLabel={`This week at ${props.barName}: ${shortDay(itemDay(first), from)}, ${first.name}${on.length > 1 ? `, and ${on.length - 1} more` : ''}. Open the week`}
      onPress={() => setOpen(true)}
      style={[styles.line1, { backgroundColor: ds.c.surface, borderColor: withAlpha(color(first), 0.4) }]}
    >
      <View style={styles.flex}>
        <Caption tone="muted">
          <Caption color={ds.accentText} style={styles.when}>
            {shortDay(itemDay(first), from)}
          </Caption>
          {` · ${count}`}
        </Caption>
        <Body numberOfLines={1}>{first.name}</Body>
      </View>
      <IconSymbol name="chevron.down" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

function TonightCard({ event }: { event: WeekItem }) {
  const ds = useDs();
  const router = useRouter();
  const color = useDotColor()(event);
  const from = useWeekStart();
  const when = shortDay(itemDay(event), from);
  const detail = detailLine(event);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${kindLabel(event)} ${when}: ${event.name}. ${detail}`}
      onPress={() => router.push(`/e/${event.id}` as Href)}
      style={[styles.card, { backgroundColor: ds.c.surface, borderColor: color }]}
    >
      {/* When on the left in the accent, the kind on the right in its colour (week-bar-public). */}
      <View style={styles.cardHead}>
        <Caption color={ds.accentText} style={styles.flex}>
          {[when, timeLine(event)].filter(Boolean).join(' · ')}
        </Caption>
        <Caption color={color}>{kindLabel(event)}</Caption>
      </View>
      <Title>{event.name}</Title>
      <Caption tone="muted">{event.description || detail}</Caption>
      {event.ticketUrl ? <TextLink label="Book or get tickets" onPress={() => Linking.openURL(event.ticketUrl!)} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  list: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line1: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md + 2, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: 1 },
  when: { fontFamily: fontFamilies.bodySemiBold },
  feed: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, alignSelf: 'flex-start' },
});
