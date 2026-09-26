import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { DrinkImage, useDs } from '@/components/ds';
import { withAlpha } from '@/lib/color';

interface DrinkHeroProps {
  name: string;
  imageUrl: string | number | null;
  glass: string | null;
  generated?: boolean;
  /** Colours from the photo (images.palette), once they exist. */
  palette?: string[] | null;
  height: number;
  /** Phone: the photo fades into the page. Wide: it sits in its own column. */
  fade: boolean;
}

/**
 * The drink's picture, full bleed. Until photos carry a palette, the field
 * behind it is the page ground; with one, the drink's own colour glows through
 * (docs/design_system.md, "Drink field").
 */
export function DrinkHero({ name, imageUrl, glass, generated, palette, height, fade }: DrinkHeroProps) {
  const ds = useDs();
  const glow = palette?.[0] ? withAlpha(palette[0], ds.scheme === 'dark' ? 0.35 : 0.22) : null;
  return (
    <View style={{ height, backgroundColor: ds.c.paper }}>
      <DrinkImage
        source={imageUrl}
        generated={generated}
        glass={glass}
        accessibilityLabel={name}
        radius={0}
        style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])}
      />
      {fade ? (
        <LinearGradient
          colors={[withAlpha(ds.c.ground, 0.35), 'transparent', glow ?? 'transparent', ds.c.ground]}
          locations={[0, 0.25, 0.7, 1]}
          style={styles.overlay}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
});
