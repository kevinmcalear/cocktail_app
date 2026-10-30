import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, Segmented, Switch, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { Need, RunSheet } from '@/lib/runSheet';
import { thingCount } from '@/lib/runSheetText';

import { OwnerSheet } from './OwnerSheet';
import { Dot, OwnerChip, type PartyLook } from './parts';

// The extra for testing and tasting, as a choice of a few steps.
const MARGINS = ['0', '5', '10', '15', '20', '25'] as const;

/** Step 3: everything the drinks need, and who brings each thing (board "3. Who brings what"). */
export function WhoStep({ menuId, sheet, looks, breakDown, onBreakDown, margin, onMargin, wide }: {
  menuId: string;
  sheet: RunSheet;
  looks: PartyLook[];
  breakDown: boolean;
  onBreakDown: (on: boolean) => void;
  /** Percent extra on everything to make or buy, for testing and tasting during prep. */
  margin: number;
  onMargin: (pct: number) => void;
  /** Desktop: the amount sits in its own column. */
  wide?: boolean;
}) {
  const ds = useDs();
  const [owning, setOwning] = useState<{ title: string; itemIds: string[]; current?: string | null; picked?: boolean } | null>(null);
  const lookOf = (id: string | null) => looks.find((l) => l.id === id) ?? looks[0];
  const counts = new Map(sheet.parties.map((p) => [p.id, p.needs.length]));

  const row = (n: Need) => (
    <View key={n.key} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <DsText variant="label">{n.name}</DsText>
        {wide ? (n.forDrinks.length ? <Caption tone="muted" numberOfLines={1}>{n.forDrinks.join(', ')}</Caption> : null) : (
          <Caption tone="muted" style={styles.mono}>{n.detail ? `${n.amount} · ${n.detail}` : n.amount}</Caption>
        )}
      </View>
      {wide ? (
        <View style={styles.qty}>
          <Caption style={styles.mono}>{n.amount}</Caption>
          {n.detail ? <Caption tone="muted" style={styles.mono}>{n.detail}</Caption> : null}
        </View>
      ) : null}
      {n.itemId ? (
        <OwnerChip look={lookOf(n.ownerId)} need={n.name} onPress={() => setOwning({ title: `Who brings ${n.name}?`, itemIds: [n.itemId!], current: n.ownerId, picked: n.picked })} />
      ) : (
        <Caption tone="muted">{lookOf(n.ownerId).short}</Caption>
      )}
    </View>
  );

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.tiles}>
        {looks.map((l) => (
          <View key={l.id ?? 'host'} style={[styles.tile, { backgroundColor: ds.c.surface }]}>
            <View style={styles.tileHead}>
              <Dot colour={l.colour} size={10} />
              <Caption numberOfLines={1} style={{ fontFamily: fontFamilies.bodySemiBold, flex: 1 }}>{l.name}</Caption>
            </View>
            <Caption tone="muted">{`${l.role} · ${thingCount(counts.get(l.id) ?? 0)}`}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.toggle}>
        <Body style={{ flex: 1 }}>Break what’s made in-house into what it’s made from</Body>
        <Switch value={breakDown} onValueChange={onBreakDown} label="Break what’s made in-house into what it’s made from" />
      </View>
      <View style={{ gap: space.sm }}>
        <Body>Extra for testing and tasting</Body>
        <Segmented
          options={MARGINS.map((m) => ({ value: m, label: m === '0' ? 'None' : `${m}%` }))}
          value={(MARGINS as readonly string[]).includes(String(margin)) ? (String(margin) as (typeof MARGINS)[number]) : '10'}
          onChange={(m) => onMargin(Number(m))}
          accessibilityLabel="Extra for testing and tasting"
          variant="pill"
          choice
          stretch
        />
        <Caption tone="muted">Added to everything to make or buy, and to the bottles to get. Serves, glasses and ice stay as counted.</Caption>
      </View>
      {!sheet.groups.length ? <Body tone="muted">Set some serves first: the list fills in from them.</Body> : null}
      {sheet.groups.map((g) => {
        const ids = g.needs.map((n) => n.itemId).filter((id): id is string => !!id);
        return (
          <View key={g.key} role="group" aria-label={g.title} style={{ gap: space.xs }}>
            <View style={styles.groupHead}>
              <Headline>{g.title}</Headline>
              {ids.length > 1 ? (
                <Button label="Assign all" size="sm" variant="ghost" accessibilityLabel={`Assign all ${g.title.toLowerCase()} to one of the venues or brands`} onPress={() => setOwning({ title: `Assign all ${g.title.toLowerCase()} to…`, itemIds: ids })} />
              ) : null}
            </View>
            <View style={[styles.group, { backgroundColor: ds.c.surface }]}>{g.needs.map(row)}</View>
          </View>
        );
      })}
      {owning ? <OwnerSheet menuId={menuId} looks={looks} {...owning} onClose={() => setOwning(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.control, padding: space.md, gap: space.xs },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: layout.minTapTarget },
  group: { borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.xs, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
  qty: { alignItems: 'flex-end', minWidth: 120 },
  mono: { fontFamily: fontFamilies.mono },
});
