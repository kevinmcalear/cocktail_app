import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, Spec, Tag, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import type { PrepList } from '@/lib/prep';

function when(date: Date): string {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `today ${time}` : `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHead, { borderBottomColor: ds.c.line }]}>
        <Headline role="heading">{title}</Headline>
        <Caption tone="muted">{count}</Caption>
      </View>
      {children}
    </View>
  );
}

/** What to make (with start-by times) and what to order, grouped by supplier. */
export function PrepLists({ list }: { list: PrepList }) {
  const ds = useDs();
  const orderCount = list.order.reduce((n, g) => n + g.lines.length, 0);
  return (
    <View style={styles.lists}>
      <Section title="To make" count={list.make.length}>
        {list.make.length === 0 ? <Body tone="muted">Nothing house-made on this menu.</Body> : null}
        {list.make.map((m) => (
          <View key={m.id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <View style={styles.rowMain}>
              <Body style={styles.name}>{m.name}</Body>
              <Caption tone="muted">{['for ' + m.forDrinks.join(', '), m.leadTimeNote].filter(Boolean).join(' · ')}</Caption>
              {m.startBy ? (
                <Tag
                  label={m.late ? `Start now · was due ${when(m.startBy)}` : `Start by ${when(m.startBy)}`}
                  tone={m.urgent ? 'warning' : 'default'}
                />
              ) : null}
            </View>
            <View style={styles.rowAmount}>
              <Spec tone="accent" align="right">{m.needed}</Spec>
              {m.batches ? <Caption tone="muted" align="right">{m.batches}</Caption> : null}
            </View>
          </View>
        ))}
      </Section>

      <Section title="To order" count={orderCount}>
        {orderCount === 0 ? <Body tone="muted">Nothing to order.</Body> : null}
        {list.order.map((group) => (
          <View key={group.supplier} style={styles.group}>
            <Caption tone="muted" style={styles.supplier}>
              {group.supplier.toUpperCase()}
            </Caption>
            {group.lines.map((l) => (
              <View key={l.id} style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <Body style={styles.rowMain}>{l.name}</Body>
                <View style={styles.rowAmount}>
                  <Spec tone="accent" align="right">{l.packs ?? l.needed}</Spec>
                  {l.packs ? <Caption tone="muted" align="right">{l.needed}</Caption> : null}
                </View>
              </View>
            ))}
          </View>
        ))}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  lists: { gap: space.xxl },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
  rowMain: { flex: 1, gap: space.xs },
  rowAmount: { alignItems: 'flex-end', gap: 2 },
  name: { fontFamily: fontFamilies.bodySemiBold },
  group: { gap: 0 },
  supplier: { letterSpacing: 1.2, marginTop: space.md },
});
