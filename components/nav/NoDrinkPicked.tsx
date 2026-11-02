import { StyleSheet, View } from 'react-native';

import { Body, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';

import { ScreenHeader } from './ScreenHeader';

/**
 * Drinks' first page on a desktop: the list is beside it (DrinksSplit.tsx), so
 * it waits for a pick, with Add at its top right. Its own file, so the tabs'
 * stack layout (which draws DrinksList) doesn't carry the header: every tab's
 * first page already has its own copy, and on the web the two loaded together.
 */
export function NoDrinkPicked() {
  const ds = useDs();
  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <ScreenHeader />
      <Body tone="muted" style={styles.empty}>
        Pick a drink to see it here.
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  empty: { padding: space.xxl },
});
