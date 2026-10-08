import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { confirmAsync } from '@/lib/dialogs';
import { itemHref } from '@/lib/itemRoutes';
import { SHELF_FOLDED } from '@/lib/myBarRows';
import { bottleLine, type ShelfSort } from '@/lib/pantry';

const SORTS: { value: ShelfSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'used', label: 'Most used' },
  { value: 'unused', label: 'Unused' },
  { value: 'az', label: 'A to Z' },
  { value: 'style', label: 'By style' },
];
/** A shelf this long gets a search box. */
const SEARCH_FROM = 9;

/**
 * The top of "Your shelf": its count, a search box for a long shelf, and the
 * sorts. The bottles are rows of My Bar's list (BottleRow), then ShelfFoot.
 */
export function ShelfHead({ count, sort, onSort, query, onQuery }: { count: number; sort: ShelfSort; onSort: (sort: ShelfSort) => void; query: string; onQuery: (query: string) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">Your shelf</Headline>
        <Caption tone="muted">
          {count} {count === 1 ? 'bottle' : 'bottles'}
        </Caption>
      </View>
      {count >= SEARCH_FROM ? (
        <Field label="Search your bottles" value={query} onChangeText={onQuery} placeholder="Gin, Campari…" autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      ) : null}
      {count > 1 ? (
        <View role="radiogroup" accessibilityLabel="Sort your bottles" style={styles.sorts}>
          {SORTS.map((s) => (
            <Chip key={s.value} label={s.label} quiet selected={sort === s.value} onPress={() => onSort(s.value)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Under the bottles: why none show, or Show all / Show fewer. */
export function ShelfFoot({ found, sort, query, open, onOpen }: { found: number; sort: ShelfSort; query: string; open: boolean; onOpen: (open: boolean) => void }) {
  const q = query.trim();
  const note = q && !found ? `No bottle on your shelf matches “${q}”.` : sort === 'unused' && !found ? 'Every bottle goes into something you can make.' : null;
  if (!note && (q || found <= SHELF_FOLDED)) return null;
  return (
    <View style={styles.foot}>
      {note ? <Body tone="muted">{note}</Body> : null}
      {!q && found > SHELF_FOLDED ? <Button label={open ? 'Show fewer' : `Show all ${found}`} variant="ghost" onPress={() => onOpen(!open)} /> : null}
    </View>
  );
}

/**
 * One bottle on the shelf: drawing, name, maker and strength, and how many
 * drinks it goes into. Memoized: a list row, re-rendered by every change to the list.
 */
export const BottleRow = memo(function BottleRow({ item, heading, onRemove }: { item: ShelfItem; heading: string | null; onRemove: (id: string) => void }) {
  const ds = useDs();
  const router = useRouter();
  const line = bottleLine(item);
  const used = item.uses ? `In ${item.uses} ${item.uses === 1 ? 'drink' : 'drinks'}` : 'Not used yet';
  const remove = async () => {
    const ok = await confirmAsync({ title: `Take ${item.name} off your shelf?`, message: 'Drinks that need it leave What to make.', confirmText: 'Take off', destructive: true });
    if (ok) onRemove(item.id);
  };
  return (
    <View>
      {heading ? (
        <Caption tone="muted" style={styles.group}>
          {heading}
        </Caption>
      ) : null}
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <PressableScale role="link" accessibilityLabel={[item.name, line, used].filter(Boolean).join(', ')} onPress={() => router.push(itemHref('Ingredient', item.id) as never)} style={styles.open}>
          <IngredientThumb id={item.id} name={item.name} size={44} />
          <View style={styles.text}>
            <Body numberOfLines={1}>{item.name}</Body>
            {line ? (
              <Caption tone="muted" numberOfLines={1}>
                {line}
              </Caption>
            ) : null}
          </View>
          <Caption tone={item.uses ? 'accent' : 'muted'} aria-hidden>
            {used}
          </Caption>
        </PressableScale>
        <PressableScale accessibilityLabel={`Take ${item.name} off your shelf`} onPress={remove} style={styles.remove}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: space.md, paddingBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  foot: { gap: space.md, paddingTop: space.md },
  group: { paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: layout.minTapTarget },
  text: { flex: 1, gap: 2 },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
