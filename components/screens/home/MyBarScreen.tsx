import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline, PressableScale, Surface, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useFlavorCatalog, useMyTaste } from '@/hooks/useFlavor';
import { useMyBar, useShelfEdit, type BarItem } from '@/hooks/useHomeBar';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { AddBottlesSheet } from './AddBottlesSheet';

/** "Negroni, Old Pal and 4 more" */
function drinkList(drinks: BarItem[]): string {
  const names = drinks.slice(0, 2).map((d) => d.name);
  const more = drinks.length - names.length;
  return more > 0 ? `${names.join(', ')} and ${more} more` : names.join(' and ');
}

function ShelfChip({ item, onRemove }: { item: BarItem; onRemove: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      accessibilityLabel={`Remove ${item.name} from your shelf`}
      onPress={onRemove}
      style={[styles.chip, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
    >
      <Caption>{item.name}</Caption>
      <IconSymbol name="xmark" size={14} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * My Bar, in home mode: the bottles on your shelf, what they make (house-made
 * syrups included), what one more bottle would unlock, and then every other
 * drink you could make at home (classics and drinks shared with you).
 */
export function MyBarScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const { add, remove } = useShelfEdit();
  const [adding, setAdding] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const empty = !bar.isLoading && bar.shelf.length === 0;
  const others = bar.drinks.filter((d) => !bar.canMakeIds.has(d.id));

  const { data: me } = useMyTaste();
  const catalog = useFlavorCatalog();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const matchFor = (id: string) => {
    const profile = scored && catalog.data?.find((d) => d.id === id)?.profile;
    return profile ? `${matchPercent(scored, profile)}% match` : undefined;
  };

  const header = (
    <>
      <ScreenHeaderSpacer />
      <View style={styles.body}>
          <View>
            <Display>My Bar</Display>
            <Caption tone="muted">
              {bar.isLoading
                ? 'Checking your shelf…'
                : empty
                  ? 'Add the bottles you have to see what you can make.'
                  : `${bar.canMake.length} ${bar.canMake.length === 1 ? 'drink' : 'drinks'} you can make`}
            </Caption>
          </View>
          {bar.error ? <Body tone="muted">Couldn’t load your bar. Try again in a moment.</Body> : null}

          <View style={styles.section}>
            <Headline role="heading">On your shelf</Headline>
            <View style={styles.chips}>
              {bar.shelf.map((item) => (
                <ShelfChip key={item.id} item={item} onRemove={() => remove.mutate(item.id)} />
              ))}
            </View>
            <View style={styles.chips}>
              <Button label={empty ? 'Add your bottles' : 'Add bottles'} icon="plus" variant={empty ? 'primary' : 'secondary'} onPress={() => setAdding(true)} />
              <Button label="Snap a bottle" icon="camera.fill" variant="secondary" onPress={() => setSnapping(true)} />
            </View>
          </View>

          {bar.oneAway.length ? (
            <View style={styles.section}>
              <Headline role="heading">One bottle away</Headline>
              {bar.oneAway.slice(0, 6).map(({ ingredient, drinks }) => (
                <Surface key={ingredient.id} style={styles.away}>
                  <View style={styles.awayText}>
                    <Headline numberOfLines={1}>{ingredient.name}</Headline>
                    <Caption tone="muted">{drinkList(drinks)}</Caption>
                  </View>
                  <Button label="Add" variant="secondary" onPress={() => add.mutate(ingredient.id)} />
                </Surface>
              ))}
            </View>
          ) : null}

          {bar.canMake.length ? (
            <View>
              <Headline role="heading">You can make</Headline>
              {bar.canMake.map((d) => (
                <DrinkRow key={d.id} name={d.name} itemId={d.id} href={itemHref('Cocktail', d.id)} imageUrl={d.imageUrl} glass={d.glass} caption={matchFor(d.id)} />
              ))}
            </View>
          ) : null}

          {others.length ? (
            <View style={styles.more}>
              <Headline role="heading">Make it yourself</Headline>
              <Caption tone="muted">{bar.shelf.length ? 'Classics and drinks shared with you, for when you have the bottles' : 'Classics and drinks shared with you'}</Caption>
            </View>
          ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={others}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
        renderItem={({ item }) => (
          <DrinkRow name={item.name} itemId={item.id} href={itemHref('Cocktail', item.id)} imageUrl={item.imageUrl} glass={item.glass} caption={matchFor(item.id)} />
        )}
      />
      <AddBottlesSheet
        visible={adding}
        onShelf={bar.shelfIds}
        onToggle={(item, on) => (on ? add.mutate(item.id) : remove.mutate(item.id))}
        onClose={() => setAdding(false)}
      />
      <BottlePhotoSheet visible={snapping} target={{ kind: 'home' }} onClose={() => setSnapping(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.xl },
  more: { gap: space.xs },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  away: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  awayText: { flex: 1, gap: 2 },
});
