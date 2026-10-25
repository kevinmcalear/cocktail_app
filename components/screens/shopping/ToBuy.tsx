import { useRouter, type Href } from 'expo-router';
import { createContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, IngredientThumb, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';
import { useShoppingEdit, useShoppingList } from '@/hooks/useShoppingList';
import { listOpens } from '@/lib/shoppingList';

const STRIP = 6;

/** The shelf's bottles marked running low and still to buy, for My Bar's tiles (shopping B1's "Low"). */
export const RunningLow = createContext<ReadonlySet<string>>(new Set());

/** Gives My Bar's tiles what's running low, from one read of the list. */
export function RunningLowProvider({ children }: { children: ReactNode }) {
  const rows = useShoppingList().data ?? [];
  const low = new Set(rows.flatMap((r) => (r.source === 'running_low' && !r.gotAt && r.itemId ? [r.itemId] : [])));
  return <RunningLow value={low}>{children}</RunningLow>;
}

/** My Bar's way into the list (shopping B1): a basket in the header, with how many things are on it. */
export function ShoppingBasket() {
  const ds = useDs();
  const router = useRouter();
  const count = (useShoppingList().data ?? []).filter((r) => !r.gotAt).length;
  return (
    <PressableScale role="link" accessibilityLabel={count ? `Shopping list, ${count} ${count === 1 ? 'thing' : 'things'}` : 'Shopping list'} onPress={() => router.push('/shopping' as Href)} style={styles.basketHit}>
      <View style={[styles.basket, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="basket" size={18} color={ds.c.ink} />
      </View>
      {count ? (
        <View style={[styles.badge, { backgroundColor: ds.accentFill.fill }]} aria-hidden>
          <Caption color={ds.accentFill.text} style={styles.badgeText}>
            {String(count)}
          </Caption>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** "To buy · 6": what's on the list, what it opens and what's running low, when there's something on it (shopping B1). */
export function ToBuyStrip() {
  const ds = useDs();
  const router = useRouter();
  const bar = useMyBar();
  const open = (useShoppingList().data ?? []).filter((r) => !r.gotAt);
  if (!open.length) return null;
  const opens = listOpens(open, bar.oneAway, bar.twoAway);
  const low = open.filter((r) => r.source === 'running_low').length;
  const line = [opens ? `Opens ${opens === 1 ? '1 more drink' : `${opens} more drinks`}.` : null, low ? `${low} running low.` : null].filter(Boolean).join(' ');
  return (
    <PressableScale role="link" accessibilityLabel={[`To buy, ${open.length}`, line].filter(Boolean).join('. ')} onPress={() => router.push('/shopping' as Href)} style={[styles.strip, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.stripHead}>
        <View style={styles.grow}>
          <DsText variant="headline">{`To buy · ${open.length}`}</DsText>
          {line ? <Caption tone="muted">{line}</Caption> : null}
        </View>
        <View style={styles.openList}>
          <DsText variant="body" color={ds.accentText}>
            Open list
          </DsText>
          <IconSymbol name="chevron.right" size={16} color={ds.accentText} />
        </View>
      </View>
      <View style={styles.thumbs} aria-hidden>
        {open.slice(0, STRIP).map((r) => (
          <IngredientThumb key={r.id} id={r.itemId} name={r.name} size={48} />
        ))}
      </View>
    </PressableScale>
  );
}

/** One away's bottle to buy (shopping In 3): To buy puts it on the list; On list once it's there. */
export function ToBuyButton({ bottles }: { bottles: readonly { id?: string; name: string }[] }) {
  const rows = useShoppingList().data ?? [];
  const edit = useShoppingEdit();
  const ids = bottles.flatMap((b) => (b.id ? [{ id: b.id, name: b.name }] : []));
  if (!ids.length) return null;
  if (ids.every((b) => rows.some((r) => r.itemId === b.id && !r.gotAt))) return <Tag label="On list" tone="accent" />;
  const names = ids.map((b) => b.name).join(' and ');
  return <Button label="To buy" variant="secondary" size="sm" accessibilityLabel={`Put ${names} on your shopping list`} onPress={() => edit.add.mutate(ids.map((b) => ({ itemId: b.id, name: b.name, source: 'one_away' as const })))} />;
}

const styles = StyleSheet.create({
  basketHit: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  basket: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '600' },
  strip: { gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0, gap: 1 },
  openList: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  thumbs: { flexDirection: 'row', gap: space.sm, overflow: 'hidden' },
});
