import { StyleSheet, View } from 'react-native';

import { Body, useDs } from '@/components/ds';
import { bottlesFor, useBottleFacts } from '@/components/screens/drinks/Bottles';
import { DrinkPane, OtherPane } from '@/components/screens/drinks/DrinksPanes';
import { useStaffDrinks } from '@/components/screens/drinks/useStaffDrinks';
import { space } from '@/constants/tokens';

import { ScreenHeader } from './ScreenHeader';

/**
 * Drinks' first page on a desktop: the list is beside it (DrinksSplit.tsx),
 * so this shows the list's first row, as the tablet's pane does, rather than
 * a blank page. The list keeps /drinks in step with its view
 * (useDrinksView), so the same view read here gives the same first row,
 * which the list lights. A drink is its page; a bottle or a house-made its
 * name and a way to its page; Classics (its own ordered list) and an empty
 * view leave the line. Its own file, so the tabs' stack layout (which draws
 * DrinksList) doesn't carry the header: every tab's first page already has
 * its own copy, and on the web the two loaded together.
 */
export function NoDrinkPicked() {
  const ds = useDs();
  const d = useStaffDrinks(false);
  const bottles = useBottleFacts(d.activeId, d.published);
  const inView = d.show === 'bottles' ? bottlesFor(d.inView, d.params.kind, bottles.low) : d.inView;
  const first = [...inView].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      {first?.category === 'Cocktail' ? (
        <DrinkPane key={first.id} id={first.id} />
      ) : (
        <>
          <ScreenHeader />
          {first ? (
            <OtherPane item={first} />
          ) : (
            <Body tone="muted" style={styles.empty}>
              Pick a drink to see it here.
            </Body>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  empty: { padding: space.xxl },
});
