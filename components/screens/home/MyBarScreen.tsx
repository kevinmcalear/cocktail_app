import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline, PressableScale, Surface, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useMyBar, useShelfEdit, type BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

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
 * syrups included), and what one more bottle would unlock.
 */
export function MyBarScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const { add, remove } = useShelfEdit();
  const [adding, setAdding] = useState(false);
  const empty = !bar.isLoading && bar.shelf.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <ScreenHeader />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
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
            <Button
              label={empty ? 'Add your bottles' : 'Add bottles'}
              icon="plus"
              variant={empty ? 'primary' : 'secondary'}
              onPress={() => setAdding(true)}
              style={styles.start}
            />
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
                <DrinkRow key={d.id} name={d.name} href={itemHref('Cocktail', d.id)} imageUrl={d.imageUrl} glass={d.glass} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <AddBottlesSheet
        visible={adding}
        bottles={bar.bottles}
        onShelf={bar.shelfIds}
        onToggle={(item, on) => (on ? add.mutate(item.id) : remove.mutate(item.id))}
        onClose={() => setAdding(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.xl, maxWidth: 760, width: '100%' },
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
  start: { alignSelf: 'flex-start' },
  away: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  awayText: { flex: 1, gap: 2 },
});
