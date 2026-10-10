import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { dayHeading, detailLine, kindLabel, type WeekItem } from '@/lib/week';

import { useDotColor, WeekDot, WeekLine, weekHref } from './WeekParts';

interface DayProps {
  days: { day: string; items: WeekItem[] }[];
  from: Date;
  member: boolean;
  /** Shows "+ Add" on each day, for people who may add events. */
  onAdd?: (day: string) => void;
}

/** Desktop: the week as seven columns of cards, today first and underlined in the accent. `bar` names each card's bar, for home. */
export function WeekColumns({ days, from, member, onAdd, bar }: DayProps & { bar?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.grid}>
      {days.map(({ day, items }) => {
        const h = dayHeading(day, from);
        return (
          <View key={day} style={styles.column}>
            <View style={[styles.colHead, { borderBottomColor: h.lead ? ds.accentText : ds.c.lineStrong, borderBottomWidth: h.lead ? 2 : StyleSheet.hairlineWidth }]}>
              {h.lead ? <Caption color={ds.accentText}>{h.lead}</Caption> : null}
              <DsText variant="caption" style={styles.mono}>
                {h.date}
              </DsText>
            </View>
            {items.map((item) => (
              <WeekCard key={`${item.kind}-${item.id}`} item={item} member={member} bar={bar} />
            ))}
            {onAdd ? <AddButton day={h.date} onPress={() => onAdd(day)} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Phones and tablets: each day as a heading with its lines under it. */
export function WeekAgenda({ days, from, member, onAdd, bar }: DayProps & { bar?: boolean }) {
  const ds = useDs();
  return (
    <View style={styles.agenda}>
      {days.map(({ day, items }) => {
        const h = dayHeading(day, from);
        if (!items.length && !onAdd) return null;
        return (
          <View key={day} style={styles.agendaDay}>
            <View style={styles.agendaHead}>
              <DsText variant="caption" color={h.lead ? ds.accentText : ds.c.muted} style={styles.mono}>
                {[h.lead, h.date].filter(Boolean).join(' · ')}
              </DsText>
              {onAdd ? <AddButton day={h.date} onPress={() => onAdd(day)} small /> : null}
            </View>
            {items.map((item) => (
              <WeekLine key={`${item.kind}-${item.id}`} item={item} from={from} member={member} bar={bar} lead="none" />
            ))}
            {!items.length ? <Caption tone="muted">Nothing on</Caption> : null}
          </View>
        );
      })}
    </View>
  );
}

function WeekCard({ item, member, bar }: { item: WeekItem; member: boolean; bar?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const color = useDotColor()(item);
  const detail = [bar ? item.barName : null, detailLine(item)].filter(Boolean).join(' · ');
  const teamOnly = item.kind === 'event' && !item.isPublic;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${kindLabel(item)}: ${item.name}. ${detail}`}
      onPress={() => router.push(weekHref(item, member))}
      style={[
        styles.card,
        item.kind === 'menu'
          ? { backgroundColor: ds.c.surface, borderColor: color }
          : teamOnly
            ? { borderColor: ds.c.lineStrong, borderStyle: 'dashed' }
            : { backgroundColor: ds.c.surface, borderColor: ds.c.line },
      ]}
    >
      <View style={styles.kind}>
        <WeekDot item={item} />
        <Caption tone="muted" numberOfLines={1} style={styles.flex}>
          {kindLabel(item).replace(', team only', '')}
        </Caption>
      </View>
      <DsText numberOfLines={3}>{item.name}</DsText>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
      {member && item.kind !== 'drink' ? (
        <View style={styles.kind}>
          <IconSymbol name={item.isPublic ? 'globe' : 'lock.fill'} size={12} color={ds.c.muted} />
          <Caption tone="muted">{item.isPublic ? 'Everyone' : 'Team only'}</Caption>
        </View>
      ) : null}
    </PressableScale>
  );
}

function AddButton({ day, onPress, small }: { day: string; onPress: () => void; small?: boolean }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`Add an event on ${day}`} onPress={onPress} style={[styles.add, small && styles.addSmall, { borderColor: ds.c.lineStrong }]}>
      <IconSymbol name="plus" size={14} color={ds.c.muted} />
      <Caption tone="muted">Add</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space.sm },
  column: { flex: 1, minWidth: 0, gap: space.sm },
  colHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, paddingBottom: space.xs },
  mono: { fontFamily: fontFamilies.mono },
  card: { gap: space.xs, padding: space.md, borderRadius: radius.control, borderWidth: 1, borderCurve: 'continuous' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed' },
  addSmall: { minHeight: 36, paddingHorizontal: space.md },
  agenda: { gap: space.lg },
  agendaDay: { gap: space.xs },
  agendaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
});
