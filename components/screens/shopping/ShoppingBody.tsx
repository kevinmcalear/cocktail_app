import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Display, DsText, Segmented, TextLink, Title, useDs, useToast } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useFinishedBottles, useMyBar } from '@/hooks/useHomeBar';
import { useBoughtBefore, useShoppingEdit, useShoppingList, type ShoppingAdd as Add } from '@/hooks/useShoppingList';
import { gotLine, listOpens, opensWith, shoppingGroups, shoppingSummary, shoppingText, whyLine, type ShoppingMode, type ShoppingRow } from '@/lib/shoppingList';

import { ShoppingAdd } from './ShoppingAdd';
import { GotRow, ShoppingItemRow } from './ShoppingRows';
import { ShareShoppingSheet, ShoppingDoneSheet } from './ShoppingSheets';

const MODES = [
  { value: 'shop', label: 'By shop' },
  { value: 'drink', label: 'By drink' },
] as const;
const BEFORE = 8;

/**
 * The shopping list (design B, board B2): a checklist built for the shop,
 * grouped by where you buy each thing or what it's for. Ticking a thing puts
 * it on your shelf, with Undo; ticked things wait under Got it until Clear.
 * The page (ShoppingScreen) and My Bar's desktop column (d55) both draw it;
 * `back` sits left of Share, `column` sets the title smaller.
 */
export function ShoppingBody({ back, column = false }: { back?: ReactNode; column?: boolean }) {
  const toast = useToast();
  const { data: rows = [], isLoading } = useShoppingList();
  const bar = useMyBar();
  const before = useBoughtBefore().data ?? [];
  const finished = useFinishedBottles().data ?? [];
  const edit = useShoppingEdit();
  const [mode, setMode] = useState<ShoppingMode>('shop');
  const [sharing, setSharing] = useState(false);
  // Back from the shop: once something is ticked here and nothing is left to get.
  const [tickedHere, setTickedHere] = useState(false);
  const [doneClosed, setDoneClosed] = useState(false);
  // What the shelf made when the page opened, so Back from the shop can say what's new.
  const [madeBefore, setMadeBefore] = useState<string[] | null>(null);
  if (!madeBefore && !bar.isLoading) setMadeBefore([...bar.canMakeIds]);

  const open = rows.filter((r) => !r.gotAt);
  const got = rows.filter((r) => r.gotAt);
  const groups = shoppingGroups(open, mode, bar.oneAway);
  const opens = (r: ShoppingRow) => opensWith(r.itemId, bar.oneAway);
  const listed = new Set(rows.flatMap((r) => (r.itemId ? [r.itemId] : [])));
  // Finished bottles and things ticked before, not on the shelf or the list now.
  const again = [...finished.map((f) => ({ itemId: f.itemId, name: f.name })), ...before].filter((b, i, all) => !bar.shelfIds.has(b.itemId) && !listed.has(b.itemId) && all.findIndex((x) => x.itemId === b.itemId) === i).slice(0, BEFORE);

  const add = (a: Add) => edit.add.mutate([a]);
  const toggle = (row: ShoppingRow, on: boolean) => {
    edit.tick.mutate({ row, got: on });
    if (!on) return;
    setTickedHere(true);
    toast.show({ title: row.name, detail: gotLine(row, opens(row)), action: { label: 'Undo', onPress: () => edit.tick.mutate({ row, got: false }) } });
  };
  if (doneClosed && open.length) setDoneClosed(false);
  const done = tickedHere && !doneClosed && !open.length && got.length > 0;
  const ready = madeBefore ? bar.canMake.filter((d) => !madeBefore.includes(d.id)) : [];

  return (
    <>
        <View style={styles.top}>
          {back ?? <View />}
          {open.length ? <Button label="Share" icon="square.and.arrow.up" size="sm" variant="secondary" onPress={() => setSharing(true)} /> : null}
        </View>
        <View style={styles.title}>
          {column ? <Title>Shopping</Title> : <Display>Shopping</Display>}
          {rows.length ? <Caption tone="muted">{shoppingSummary(open.length, listOpens(open, bar.oneAway, bar.twoAway))}</Caption> : null}
        </View>
        <ShoppingAdd onShelf={bar.shelfIds} onAdd={add} onAddMadeFrom={(item, pantry) => edit.addMadeFrom.mutate({ item, onShelf: bar.shelfIds, pantry })} />
        {open.length ? <Segmented options={MODES} value={mode} onChange={setMode} accessibilityLabel="Group the list" variant="ink" choice stretch /> : null}
        {!isLoading && !rows.length ? <Body tone="muted">Nothing on your list. Add something above, or tap Add to shopping on a drink you’re a bottle short of.</Body> : null}

        {groups.map((g) => (
          <View key={g.title} style={styles.group}>
            <View style={styles.groupHead}>
              <DsText variant="body" role="heading" style={styles.bold}>
                {g.title}
              </DsText>
              <Caption tone="muted">{String(g.rows.length)}</Caption>
            </View>
            {g.rows.map((r) => (
              <ShoppingItemRow key={r.id} row={r} why={whyLine(r, opens(r))} onToggle={toggle} onRemove={(row) => edit.remove.mutate(row.id)} />
            ))}
          </View>
        ))}

        {got.length ? (
          <View style={styles.group}>
            <View style={styles.groupHead}>
              <DsText variant="body" role="heading" tone="muted" style={styles.bold}>
                Got it
              </DsText>
              <Caption tone="muted">{String(got.length)}</Caption>
              <View style={styles.grow} />
              <TextLink label="Clear" onPress={() => edit.clear.mutate(undefined)} accessibilityHint="Takes ticked things off the list" />
            </View>
            {got.map((r) => (
              <GotRow key={r.id} row={r} done={gotLine(r, opens(r))} onToggle={toggle} />
            ))}
          </View>
        ) : null}

        {again.length ? (
          <View style={styles.before}>
            <DsText variant="body" role="heading" style={styles.bold}>
              Bought before
            </DsText>
            <View style={styles.chips}>
              {again.map((b) => (
                <Chip key={b.itemId} label={b.name} selected={false} accessibilityLabel={`Add ${b.name}`} onPress={() => add({ itemId: b.itemId, name: b.name, source: 'again' })} />
              ))}
            </View>
            <Caption tone="muted">Bottles you’ve finished, and things you’ve ticked before.</Caption>
          </View>
        ) : null}
      <ShareShoppingSheet text={shoppingText(shoppingGroups(open, 'shop', bar.oneAway))} visible={sharing} onClose={() => setSharing(false)} />
      <ShoppingDoneSheet got={got} ready={ready} visible={done} onClose={() => setDoneClosed(true)} />
    </>
  );
}

/**
 * The list beside the shelf on a desktop-wide My Bar (shopping desk-mybar,
 * d55): a card with its own scroll, there while the list has anything on it.
 */
export function ShoppingColumn({ bottom, gutter }: { bottom: number; gutter: number }) {
  const ds = useDs();
  const rows = useShoppingList().data ?? [];
  if (!rows.length) return null;
  return (
    <ScrollView style={[styles.column, { marginRight: gutter }]} contentContainerStyle={{ paddingBottom: bottom }} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <ShoppingBody column />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  column: { flexGrow: 0, flexShrink: 0, width: 360 },
  card: { gap: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  title: { gap: 2 },
  group: { gap: 0 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  bold: { fontWeight: '600' },
  grow: { flex: 1 },
  before: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
