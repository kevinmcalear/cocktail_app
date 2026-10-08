import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import type { ShelfItem } from '@/hooks/useHomeBar';
import { confirmAsync } from '@/lib/dialogs';
import { itemHref } from '@/lib/itemRoutes';
import { arrangeShelf, bottleLine, type ShelfSort } from '@/lib/pantry';

const SORTS: { value: ShelfSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'used', label: 'Most used' },
  { value: 'unused', label: 'Unused' },
  { value: 'az', label: 'A to Z' },
  { value: 'style', label: 'By style' },
];
/** Bottles shown before "Show all", so the shelf never pushes the drinks off the first screen. */
const FOLDED = 5;
/** A shelf this long gets a search box. */
const SEARCH_FROM = 9;

interface ShelfSectionProps {
  bottles: ShelfItem[];
  onRemove: (item: ShelfItem) => void;
}

/** The bottles on the shelf as a list: drawing, name, maker and strength, searchable and sortable. */
export function ShelfSection({ bottles, onRemove }: ShelfSectionProps) {
  const [sort, setSort] = useState<ShelfSort>('newest');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const arranged = arrangeShelf(bottles, sort, query);
  const shown = open || query.trim() ? arranged : arranged.slice(0, FOLDED);

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">Your shelf</Headline>
        <Caption tone="muted">
          {bottles.length} {bottles.length === 1 ? 'bottle' : 'bottles'}
        </Caption>
      </View>
      {bottles.length >= SEARCH_FROM ? (
        <Field label="Search your bottles" value={query} onChangeText={setQuery} placeholder="Gin, Campari…" autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      ) : null}
      {bottles.length > 1 ? (
        <View role="radiogroup" accessibilityLabel="Sort your bottles" style={styles.sorts}>
          {SORTS.map((s) => (
            <Chip key={s.value} label={s.label} quiet selected={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
        </View>
      ) : null}
      <View>
        {shown.map((item, i) => (
          <View key={item.id}>
            {sort === 'style' && item.kind !== shown[i - 1]?.kind ? (
              <Caption tone="muted" style={styles.group}>
                {item.kind ?? 'Other'}
              </Caption>
            ) : null}
            <BottleRow item={item} onRemove={onRemove} />
          </View>
        ))}
        {query.trim() && !arranged.length ? (
          <Body tone="muted">No bottle on your shelf matches “{query.trim()}”.</Body>
        ) : sort === 'unused' && !arranged.length ? (
          <Body tone="muted">Every bottle goes into something you can make.</Body>
        ) : null}
      </View>
      {!query.trim() && arranged.length > FOLDED ? (
        <Button label={open ? 'Show fewer' : `Show all ${arranged.length}`} variant="ghost" onPress={() => setOpen(!open)} />
      ) : null}
    </View>
  );
}

function BottleRow({ item, onRemove }: { item: ShelfItem; onRemove: (item: ShelfItem) => void }) {
  const ds = useDs();
  const router = useRouter();
  const line = bottleLine(item);
  const used = item.uses ? `In ${item.uses} ${item.uses === 1 ? 'drink' : 'drinks'}` : 'Not used yet';
  const remove = async () => {
    const ok = await confirmAsync({ title: `Take ${item.name} off your shelf?`, message: 'Drinks that need it leave What to make.', confirmText: 'Take off', destructive: true });
    if (ok) onRemove(item);
  };
  return (
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
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sorts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: layout.minTapTarget },
  text: { flex: 1, gap: 2 },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
