import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Display, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { orderedPictures, type ItemImageLink } from '@/lib/itemImages';

import { DrinkHero } from './DrinkHero';

interface DrinkLoadingProps {
  /** The tapped row (lib/drinkSeeds.ts): its picture and name paint where the page's will. */
  seed?: { id: string; name: string; item_images?: unknown } | null;
}

/**
 * While the drink loads: the page's own ground, so there's no flash of the
 * old theme, and with a tapped row, its hero and name in place.
 */
export function DrinkLoading({ seed }: DrinkLoadingProps) {
  return (
    <BackbarTheme>
      <LoadingGround seed={seed} />
    </BackbarTheme>
  );
}

function LoadingGround({ seed }: DrinkLoadingProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width, height } = useWindowDimensions();
  // As DrinkPage lays out a sheet (the route always opens one).
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const heroHeight = wide ? height - top : Math.min(width, height * 0.42);
  if (!seed) return <View style={[styles.screen, { backgroundColor: ds.c.ground }]} accessibilityLabel="Loading drink" />;
  const pictures = orderedPictures(seed.item_images as ItemImageLink[] | undefined);
  const hero = <DrinkHero name={seed.name} pictures={pictures} glass={null} itemId={seed.id} height={heroHeight} fade={!wide} />;
  const name = <Display>{seed.name}</Display>;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]} accessibilityLabel={`Loading ${seed.name}`}>
      {wide ? (
        <View style={styles.row}>
          <View style={styles.heroColumn}>{hero}</View>
          <View style={[styles.readable, { paddingTop: top + layout.minTapTarget + space.xl, paddingHorizontal: gutter }]}>{name}</View>
        </View>
      ) : (
        <>
          {hero}
          <View style={{ marginTop: -space.xxl, paddingHorizontal: gutter }}>{name}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  heroColumn: { width: '42%' },
  readable: { flex: 1, maxWidth: 720 },
});
