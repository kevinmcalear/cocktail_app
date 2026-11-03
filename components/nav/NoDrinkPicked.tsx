import { StyleSheet, View } from 'react-native';

import { Body, useDs } from '@/components/ds';
import { DrinkPane, OtherPane } from '@/components/screens/drinks/DrinksPanes';
import { space } from '@/constants/tokens';
import { useDrinksFirstRow } from '@/hooks/useDrinksSplit';

import { ScreenHeader } from './ScreenHeader';

/**
 * Drinks' first page on a desktop: the list is beside it (DrinksSplit.tsx),
 * so under Add this shows the list's first row (useDrinksFirstRow, which the
 * list lights), as the tablet's pane does, rather than a blank page. A drink
 * is its page; a bottle or a house-made its name and a way to its page; a
 * loaded list with no first row (Classics, an empty view) says to pick one.
 * Its own file, so the tabs' stack layout (which draws DrinksList) doesn't
 * carry the header: every tab's first page already has its own copy, and on
 * the web the two loaded together.
 */
export function NoDrinkPicked() {
  const ds = useDs();
  const { item, ready } = useDrinksFirstRow();
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ScreenHeader />
      {item?.category === 'Cocktail' ? (
        <DrinkPane key={item.id} id={item.id} />
      ) : item ? (
        <OtherPane item={item} />
      ) : ready ? (
        <Body tone="muted" style={styles.empty}>
          Pick a drink to see it here.
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  empty: { padding: space.xxl },
});
