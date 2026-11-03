import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { OnNowPane } from '@/components/screens/library/OnNowPane';

import { ScreenHeader } from './ScreenHeader';

/**
 * Drinks' first page on a desktop: the list is beside it (DrinksSplit.tsx), so
 * until a drink is picked this shows the menu on now, with Add at its top
 * right. Its own file, so the tabs' stack layout (which draws DrinksList)
 * doesn't carry the header: every tab's first page already has its own copy,
 * and on the web the two loaded together.
 */
export function NoDrinkPicked() {
  const ds = useDs();
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ScreenHeader />
      <OnNowPane />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
