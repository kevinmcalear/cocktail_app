import { Stack, useSegments } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AddFab, DrinksList } from '@/components/nav/RootLazy';
import { useDrinksSplit } from '@/hooks/useDrinksSplit';

/**
 * Each tab's own stack. This folder is shared by the four tab groups, so a
 * page here (a drink, Prep, Study) opens on the stack of the tab it was
 * opened from, and Back returns to that tab. Each tab's first page lives in
 * its own folder ((1-tonight)/index, (2-drinks)/drinks, (3-discover)/discover,
 * (4-you)/you), so /drinks always switches to the Drinks tab rather than
 * pushing it on the tab you're in.
 *
 * Today's pages draw their own headers (components/nav/ScreenHeader.tsx), so
 * the stack's header stays hidden; a pushed page goes back with the system's
 * swipe or back button, and with its own back on the web.
 *
 * A desktop at a venue (hooks/useDrinksSplit.ts): Drinks' list stays in a
 * column on the left and the stack, with the drink picked, sits beside it.
 * The stack keeps its place in the tree either way, so crossing 1200 or
 * switching mode never resets it.
 */
export const unstable_settings = {
  '1-tonight': { anchor: 'index' },
  '2-drinks': { anchor: 'drinks' },
  '3-discover': { anchor: 'discover' },
  '4-you': { anchor: 'you' },
};

const ROOTS = [undefined, 'drinks', 'discover', 'you'];

/** `segment`: which tab's stack this is ('(2-drinks)'), from expo-router, as the folder is shared. */
export default function TabStack({ segment }: { segment?: string }) {
  // ['(tabs)', '(2-drinks)', 'drinks'] is a first page; ['(tabs)', '(1-tonight)'] is Tonight's.
  const segments = useSegments() as string[];
  const page = segments[2];
  const split = useDrinksSplit() && segment === '(2-drinks)';
  // Beside the list: Drinks' first page (nothing picked yet) or a drink. Another page (Prep, Study) takes the width.
  const listShown = segments[1] !== segment || page === 'drinks' || page === 'cocktail';
  return (
    <View style={styles.row}>
      {split ? <DrinksList shown={listShown} /> : null}
      <View style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {/* Android's Add floats on each tab's first page (AddButton.tsx); iOS and the web have the + in the header. */}
      {Platform.OS === 'android' && ROOTS.includes(page) ? <AddFab /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flex: 1, flexDirection: 'row' }, fill: { flex: 1 } });
