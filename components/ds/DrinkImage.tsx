import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CustomIcon } from '@/components/ui/CustomIcons';
import { radius as radii, space } from '@/constants/tokens';

import { Tag } from './Tag';
import { useDs } from './theme';

export interface DrinkImageProps {
  /** A URL, or a bundled image (require). */
  source?: string | number | null;
  /** Drawn by the image generator, not photographed. Always tagged "Sketch". */
  generated?: boolean;
  /** Glassware icon key (CustomIcons) drawn on paper when there's no image yet. */
  glass?: string | null;
  /** What the image shows, for screen readers (usually the drink's name). */
  accessibilityLabel: string;
  aspectRatio?: number;
  radius?: keyof typeof radii | 0;
  /** Hide the Sketch tag on tiny thumbnails; the drink page still shows it. */
  hideTag?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A drink's picture. Never falls back to another drink's photo: with no image
 * yet, it shows the drink's own glass drawn on the house-style paper.
 */
export function DrinkImage({ source, generated, glass, accessibilityLabel, aspectRatio = 1, radius = 'card', hideTag, style }: DrinkImageProps) {
  const ds = useDs();
  const borderRadius = radius === 0 ? 0 : radii[radius];
  const uri = source ?? null;
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={uri ? (generated ? `${accessibilityLabel}, sketch` : accessibilityLabel) : `${accessibilityLabel}, no photo yet`}
      style={[styles.frame, { aspectRatio, borderRadius, backgroundColor: ds.c.paper }, style]}
    >
      {uri ? (
        <Image source={typeof uri === 'string' ? { uri } : uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.empty}>
          <CustomIcon name={glass || 'Coupe'} size={64} color={ds.c.sketchInk} />
        </View>
      )}
      {uri && generated && !hideTag ? <Tag label="Sketch" tone="sketch" style={styles.tag} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderCurve: 'continuous', width: '100%' },
  empty: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  tag: { position: 'absolute', right: space.sm, bottom: space.sm },
});
