import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, Surface, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { usePairDrinks, usePairings, usePairNote } from '@/hooks/usePairings';

import { PairChip } from './PairChip';

/**
 * On an ingredient's page: what bartenders put it with, each with the number
 * of drinks behind it, and those drinks one tap away. Nothing shows until
 * there's something to say (no pairs, or an ingredient with no core one).
 */
export function PairsWith({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter();
  const { data: pairs = [] } = usePairings([itemId], { limit: 12 });
  const [open, setOpen] = useState<string | null>(null);
  const picked = pairs.find((p) => p.id === open) ?? null;
  if (!pairs.length) return null;

  return (
    <Surface style={styles.stack}>
      <View style={styles.head}>
        <Headline>Pairs with</Headline>
        <Caption tone="muted">Counted from drinks in the app. The number is how many use both.</Caption>
      </View>
      <View role="group" aria-label={`Pairs with ${name}`} style={styles.chips}>
        {pairs.map((p) => (
          <PairChip
            key={p.id}
            label={p.name}
            count={p.together[0]}
            selected={p.id === open}
            onPress={() => setOpen(p.id === open ? null : p.id)}
            accessibilityLabel={`${p.name}, in ${p.together[0]} drinks with ${name}. Show them`}
          />
        ))}
      </View>
      {picked ? <PairDrinks a={itemId} b={picked.id} title={`${picked.name} and ${name}`} /> : null}
      <Button
        label="Open the flavor map"
        variant="secondary"
        icon="sparkles"
        onPress={() => router.push({ pathname: '/flavor-map', params: { with: itemId } })}
      />
    </Surface>
  );
}

/** The drinks behind one pairing, each opening its page. */
function PairDrinks({ a, b, title }: { a: string; b: string; title: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data: drinks = [], isLoading } = usePairDrinks(a, b);
  const { data: note } = usePairNote(a, b);
  return (
    <View style={styles.drinks}>
      <Body>{title}</Body>
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {isLoading ? <Caption tone="muted">Finding the drinks…</Caption> : null}
      {drinks.map((d) => (
        <PressableScale
          key={d.id}
          role="link"
          accessibilityLabel={`Open ${d.name}`}
          onPress={() => router.push(`/cocktail/${d.id}`)}
          style={[styles.row, { borderTopColor: ds.c.line }]}
        >
          <Body numberOfLines={1} style={styles.rowName}>
            {d.name}
          </Body>
          <Caption tone="muted">{d.isCatalog ? 'Classic' : 'Bar'}</Caption>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  head: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  drinks: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTapTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1 },
});
