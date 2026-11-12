import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, useDs, useGutter } from '@/components/ds';
import { BarEndRoom } from '@/components/screens/drink/barEndRoom';
import { DrinkPane, OtherPane } from '@/components/screens/drinks/DrinksPanes';
import { VenueDeleteBanner } from '@/components/screens/venue/VenueDeleteBannerLazy';
import { layout, space } from '@/constants/tokens';
import { useDrinksFirstRow } from '@/components/screens/drinks/firstRow';

import { DeskAddButton } from './AddButton';
import { ScreenHeader } from './ScreenHeader';

/**
 * Drinks' first page on a desktop: the list is beside it (DrinksSplit.tsx),
 * so this shows the list's first row (useDrinksFirstRow, which the list
 * lights), as the tablet's pane does, rather than a blank page. A drink is
 * its page, as it looks once picked: its sky runs to the top, and "+ Add"
 * sits over it at the end of the drink's own row, after the … (the boards'
 * top right: Prod-desk-today has Add over the sky, Sta-capsules-desk the
 * round tools and then Add). A row of its own above the drink cut a dark
 * strip across the sky. A bottle or a house-made is its name and a way to
 * its page, under the header's Add; a loaded list with no first row
 * (Classics, an empty view) says to pick one.
 * Its own file, so the tabs' stack layout (which draws DrinksList) doesn't
 * carry the header: every tab's first page already has its own copy, and on
 * the web the two loaded together.
 */
export function NoDrinkPicked() {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { item, ready } = useDrinksFirstRow();
  // Add's width, so the drink's … stops short of it (BarEndRoom).
  const [addWidth, setAddWidth] = useState(0);
  if (item?.category === 'Cocktail')
    return (
      <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
        {/* A venue's delete waiting its 7 days, which the header carries on the other pages. */}
        <VenueDeleteBanner />
        <View style={styles.fill}>
          <BarEndRoom value={addWidth ? addWidth + space.sm : 0}>
            <DrinkPane key={item.id} id={item.id} />
          </BarEndRoom>
          <View style={[styles.add, { top: insets.top + space.sm, right: gutter }]} onLayout={(e) => setAddWidth(e.nativeEvent.layout.width)}>
            <DeskAddButton />
          </View>
        </View>
      </View>
    );
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ScreenHeader />
      {item ? (
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
  // In the drink's top row (PageControls): the same top, the row's height, centred in it.
  add: { position: 'absolute', height: layout.minTapTarget, justifyContent: 'center' },
});
