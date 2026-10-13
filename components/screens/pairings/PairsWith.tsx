import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, RowScore, scoreWords, Surface, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useDrinkSources } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import { usePairDrinks, usePairings, usePairNote } from '@/hooks/usePairings';

import { IconSymbol } from '@/components/ui/icon-symbol';

import { PairChip } from './PairChip';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

const FIRST = 3;

/**
 * On an ingredient's page: what bartenders put it with, each with the number
 * of drinks behind it, and those drinks one tap away. Nothing shows until
 * there's something to say (no pairs, or an ingredient with no core one).
 */
export function PairsWith({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter();
  const { data: pairs = [] } = usePairings([itemId], { limit: 8 });
  const [open, setOpen] = useState<string | null>(null);
  const picked = pairs.find((p) => p.id === open) ?? null;
  if (!pairs.length) return null;

  return (
    <View style={styles.stack}>
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
            accent
            onPress={() => setOpen(p.id === open ? null : p.id)}
            accessibilityLabel={`${p.name}, in ${p.together[0]} drinks with ${name}. Show them`}
          />
        ))}
      </View>
      <Button
        label="Open the flavor map"
        variant="secondary"
        icon="sparkles"
        onPress={() => router.push({ pathname: '/flavor-map', params: { with: itemId } })}
      />
    </Surface>
    {/* The tapped pairing's drinks are their own card under it (decided on the canvas). */}
    {picked ? <PairDrinks key={picked.id} a={itemId} b={picked.id} title={`${picked.name} and ${name}`} total={picked.together[0]} /> : null}
    </View>
  );
}

/**
 * The drinks behind one pairing, each opening its page: who made it and
 * where, Classic or Riff, its score (b02), then how many more there are.
 */
function PairDrinks({ a, b, title, total }: { a: string; b: string; title: string; total: number }) {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const [all, setAll] = useState(false);
  const { data: loaded = [], isLoading } = usePairDrinks(a, b);
  // Three, then the rest a tap away (prep-ing-campari).
  const drinks = all ? loaded : loaded.slice(0, FIRST);
  const { data: note } = usePairNote(a, b);
  const { data: sources } = useDrinkSources(drinks.map((d) => d.id));
  const { data: scores } = useItemScores(drinks.map((d) => d.id));
  const more = total - drinks.length;
  return (
    <Surface style={styles.drinks}>
      <Headline>{title}</Headline>
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {isLoading ? <Caption tone="muted">Finding the drinks…</Caption> : null}
      {drinks.map((d) => {
        const src = sources?.[d.id];
        const kind = d.isCatalog || src?.classic ? 'Classic' : src?.riff ? 'Riff' : 'Original';
        const by = src && !src.classic ? [src.by, src.city].filter(Boolean).join(', ') : null;
        const score = scores?.[d.id];
        return (
          <PressableScale
            key={d.id}
            role="link"
            accessibilityLabel={[`Open ${d.name}`, by, kind, scoreWords(score)].filter(Boolean).join(', ')}
            onPressIn={() => prefetch(d.id, { name: d.name })}
            onPress={() => router.push(`/cocktail/${d.id}`)}
            style={[styles.row, { borderTopColor: ds.c.line }]}
          >
            <View style={styles.rowName}>
              <Body numberOfLines={1}>{d.name}</Body>
              {by ? (
                <Caption tone="muted" numberOfLines={1}>
                  {by}
                </Caption>
              ) : null}
            </View>
            <Caption tone="muted">{kind}</Caption>
            <RowScore score={score} />
          </PressableScale>
        );
      })}
      {more > 0 && !isLoading ? (
        all || loaded.length <= drinks.length ? (
          <View style={[styles.row, { borderTopColor: ds.c.line }]}>
            <Caption tone="muted">{`${more} more ${more === 1 ? 'drink' : 'drinks'}`}</Caption>
          </View>
        ) : (
          <PressableScale role="button" accessibilityLabel={`Show ${more} more drinks`} onPress={() => setAll(true)} style={[styles.row, { borderTopColor: ds.c.line }]}>
            <Body style={styles.rowName}>{`${more} more ${more === 1 ? 'drink' : 'drinks'}`}</Body>
            <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
          </PressableScale>
        )
      ) : null}
    </Surface>
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
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1, minWidth: 0 },
});
