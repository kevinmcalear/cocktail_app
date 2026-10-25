import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Display, DsText, Segmented, TextLink, Title, useToast } from '@/components/ds';
import { space } from '@/constants/tokens';
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
 * The shopping list itself (design B, board B2): a checklist built for the
 * shop, grouped by where you buy each thing or what it's for. Ticking a thing
 * puts it on your shelf, with Undo; ticked things wait under Got it until
 * Clear. Its own page on a phone, with `back` beside Share; a column beside
 * My Bar's shelf on a desktop (`column`, board desk-mybar): the title beside
 * Share, by shop only, no Bought before.
 */
export function ShoppingList({ column, back }: { column?: boolean; back?: ReactNode }) {
  const toast = useToast();
  const { data: rows = [], isLoading } = useShoppingList();
  const bar = useMyBar();
  const before = useBoughtBefore().data ?? [];
  const finished = useFinishedBottles().data ?? [];
  const edit = useShoppingEdit();
  const [picked, setMode] = useState<ShoppingMode>('shop');
  const mode = column ? 'shop' : picked;
  const [sharing, setSharing] = useState(false);
  // Back from the shop: once something is ticked here and nothing is left to get.
  const [tickedHere, setTickedHere] = useState(false);
  const [doneClosed, setDoneClosed] = useState(false);
  // What the shelf made before this trip's first tick, so Back from the shop can say what's new.
  const [madeBefore, setMadeBefore] = useState<string[] | null>(null);

  const open = rows.filter((r) => !r.gotAt);
  const got = rows.filter((r) => r.gotAt);
  const groups = shoppingGroups(open, mode, bar.oneAway);
  const opens = (r: ShoppingRow) => opensWith(r.itemId, bar.oneAway);
  const listed = new Set(rows.flatMap((r) => (r.itemId ? [r.itemId] : [])));
  // Finished bottles and things ticked before, not on the shelf or the list now.
  const again = column ? [] : [...finished.map((f) => ({ itemId: f.itemId, name: f.name })), ...before].filter((b, i, all) => !bar.shelfIds.has(b.itemId) && !listed.has(b.itemId) && all.findIndex((x) => x.itemId === b.itemId) === i).slice(0, BEFORE);

  const add = (a: Add) => edit.add.mutate([a]);
  const toggle = (row: ShoppingRow, on: boolean) => {
    if (on && !tickedHere) setMadeBefore([...bar.canMakeIds]);
    edit.tick.mutate({ row, got: on });
    if (!on) return;
    setTickedHere(true);
    toast.show({ title: row.name, detail: gotLine(row, opens(row)), action: { label: 'Undo', onPress: () => edit.tick.mutate({ row, got: false }) } });
  };
  if (doneClosed && open.length) {
    setDoneClosed(false);
    setTickedHere(false);
  }
  const done = tickedHere && !doneClosed && !open.length && got.length > 0;
  const ready = madeBefore ? bar.canMake.filter((d) => !madeBefore.includes(d.id)) : [];

  const share = open.length ? <Button label="Share" icon="square.and.arrow.up" size="sm" variant="secondary" onPress={() => setSharing(true)} /> : null;
  const summary = rows.length ? <Caption tone="muted">{shoppingSummary(open.length, listOpens(open, bar.oneAway, bar.twoAway))}</Caption> : null;

  return (
    <>
      {column ? (
        <View style={styles.top}>
          <View style={styles.title}>
            <Title>Shopping</Title>
            {summary}
          </View>
          {share}
        </View>
      ) : (
        <>
          <View style={styles.top}>
            {back ?? <View />}
            {share}
          </View>
          <View style={styles.title}>
            <Display>Shopping</Display>
            {summary}
          </View>
        </>
      )}
      <ShoppingAdd
        onShelf={bar.shelfIds}
        shelfKinds={new Set(bar.shelf.flatMap((b) => (b.kind ? [b.kind.toLowerCase()] : [])))}
        onAdd={(adds) => edit.add.mutate(adds, { onSuccess: (n) => (n ? undefined : toast.show({ title: `${adds.map((a) => a.name).join(' and ')} ${adds.length === 1 ? 'is' : 'are'} on your list already.` })) })}
      />
      {open.length && !column ? <Segmented options={MODES} value={mode} onChange={setMode} accessibilityLabel="Group the list" variant="ink" choice stretch /> : null}
      {!isLoading && !rows.length ? <Body tone="muted">Nothing on your list. Add something above, or tap Add to shopping on a drink you’re a bottle short of.</Body> : null}

      {groups.map((g) => (
        <View key={g.title}>
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
        <View>
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

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, minHeight: 44 },
  title: { gap: 2, flexShrink: 1 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  bold: { fontWeight: '600' },
  grow: { flex: 1 },
  before: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
