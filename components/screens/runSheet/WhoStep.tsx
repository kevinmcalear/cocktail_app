import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, Switch, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { Need, RunSheet } from '@/lib/runSheet';
import { thingCount } from '@/lib/runSheetText';

import { OwnerSheet } from './OwnerSheet';
import { Dot, OwnerChip, type PartyLook } from './parts';

/** Step 3: everything the drinks need, and who brings each thing (board "3. Who brings what"). */
export function WhoStep({ menuId, sheet, looks, breakDown, onBreakDown, wide }: {
  menuId: string;
  sheet: RunSheet;
  looks: PartyLook[];
  breakDown: boolean;
  onBreakDown: (on: boolean) => void;
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
        <Caption tone="muted">{lookOf(null).short}</Caption>
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
            <Caption tone="muted">{`${l.role === 'Hosting' ? 'Hosting' : l.role === 'Guest venue' ? 'Guest' : 'Brand'} · ${thingCount(counts.get(l.id) ?? 0)}`}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.toggle}>
        <Body style={{ flex: 1 }}>Break house preps into what they’re made from</Body>
        <Switch value={breakDown} onValueChange={onBreakDown} label="Break house preps into what they’re made from" />
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
