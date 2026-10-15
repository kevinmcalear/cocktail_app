import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, Headline, PressableScale, useGutter } from '@/components/ds';
import { BarAway } from '@/components/screens/home/DrinksAtBars';
import { space, type } from '@/constants/tokens';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import type { Shelf } from '@/lib/discoverShelves';
import { itemHref } from '@/lib/itemRoutes';

const TILE = 112;

/** One drink on a shelf: its picture, name (two lines), and its bar and how far. */
function ShelfTile({ drink: d }: { drink: DiscoverDrink }) {
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const away = useContext(BarAway)(d.barId);
  const where = [d.bar.name, away ?? d.bar.locality].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${d.name}. ${where}`}
      onPressIn={() => prefetch(d.id, { name: d.name, imageUrl: d.imageUrl })}
      onPress={() => router.push(itemHref('Cocktail', d.id) as never)}
      style={styles.tile}
    >
      <DrinkImage thumb source={d.imageUrl} itemId={d.id} radius="control" accessibilityLabel={d.name} style={styles.picture} />
      <DsText variant="label" numberOfLines={2} style={styles.name}>
        {d.name}
      </DsText>
      <Caption tone="muted" numberOfLines={1}>
        {where}
      </Caption>
    </PressableScale>
  );
}

/**
 * Discover's shelves over the list (disc-list, disc-desk-browse): each a
 * titled row that scrolls sideways, one drink per bar, with See all setting
 * its filter on the list below. Empty shelves never reach here.
 */
export function DiscoverShelves({ shelves, onKind }: { shelves: Shelf[]; onKind?: (kind: string) => void }) {
  const gutter = useGutter();
  return shelves.map((s) => (
    <View key={s.key} role="region" aria-label={s.title} style={styles.shelf}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <Headline role="heading">{s.title}</Headline>
          <Caption tone="muted">{s.note}</Caption>
        </View>
        {s.kind && onKind ? <Button label="See all" accessibilityLabel={`See all: ${s.title}`} variant="ghost" onPress={() => onKind(s.kind!)} /> : null}
      </View>
      {/* Runs to the screen's edges, so a cut-off tile says there's more. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter }}>
        <View role="list" style={styles.row}>
          {s.drinks.map((d) => (
            <View role="listitem" key={d.id}>
              <ShelfTile drink={d} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  ));
}

const styles = StyleSheet.create({
  shelf: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  titles: { flexShrink: 1 },
  row: { flexDirection: 'row', gap: space.md },
  tile: { width: TILE, gap: space.xs },
  picture: { width: TILE, height: TILE },
  // Two lines' room always, so the captions line up across the row.
  name: { minHeight: type.label.lineHeight * 2 },
});
