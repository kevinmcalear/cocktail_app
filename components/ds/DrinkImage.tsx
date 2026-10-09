import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CustomIcon } from '@/components/ui/CustomIcons';
import { radius as radii, space } from '@/constants/tokens';
import { markNoThumb, thumbToTry } from '@/lib/thumbnails';

import { DrawnSketch } from './DrawnSketch';
import type { SketchDetail } from './SketchDrawing';
import { IngredientDrawing } from './IngredientDrawing';
import { Tag } from './Tag';
import { useDs } from './theme';

export interface DrinkImageProps {
  /** A URL, or a bundled image (require). */
  source?: string | number | null;
  /** Drawn by the image generator, not photographed. Always tagged "Sketch". */
  generated?: boolean;
  /** Glassware icon key (CustomIcons) drawn on paper when there's no image and no drawing yet. */
  glass?: string | null;
  /** The drink's id: with no image, it's drawn from its drawing inputs (item_sketches). */
  itemId?: string | null;
  /** What the image shows, for screen readers (usually the drink's name). */
  accessibilityLabel: string;
  aspectRatio?: number;
  radius?: keyof typeof radii | 0;
  /** Hide the Sketch tag on tiny thumbnails; the drink page still shows it. */
  hideTag?: boolean;
  style?: StyleProp<ViewStyle>;
  /** An ingredient instead of a drink: always its drawing (lib/sketch/ingredientArt.ts), never a photo. */
  ingredient?: { id: string | null; name: string } | null;
  /**
   * List or grid size: the 480 px copy (lib/thumbnails.ts) instead of the
   * original, which can be 2-3 MB. Falls back to the original until the copy exists.
   */
  thumb?: boolean;
  /** With no image: draw the sketch in front of you (AnimatedSketch). One per screen. */
  animate?: boolean;
  /** With no image: 'thumb' draws a lighter sketch for list rows (under about 140 wide). */
  sketchDetail?: SketchDetail;
  /** The photo's own colour (images.palette[0]) behind it while it loads, instead of plain paper. */
  placeholderColor?: string | null;
  /** Load order: 'high' for the one picture a screen is about (a drink page's hero). */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * A drink's picture. Never falls back to another drink's photo: with no image
 * yet, it shows a sketch drawn from the drink's own spec (glass, colour, ice,
 * foam, garnish), or until that exists, its glass icon on the house paper.
 */
export function DrinkImage({ source, generated, glass, itemId, accessibilityLabel, aspectRatio = 1, radius = 'card', hideTag, style, ingredient, thumb = false, animate, sketchDetail, placeholderColor, priority }: DrinkImageProps) {
  const ds = useDs();
  const borderRadius = radius === 0 ? 0 : radii[radius];
  const uri = ingredient ? null : (source ?? null);
  // The original whose thumbnail failed here; thumbToTry remembers it past this mount.
  // Read in the condition so the compiler recomputes `small` when it changes.
  const [noThumb, setNoThumb] = useState<string | null>(null);
  const small = thumb && typeof uri === 'string' && noThumb !== uri ? thumbToTry(uri) : null;
  const shown = small ?? uri;
  const glassIcon = (
    <View style={styles.empty}>
      <CustomIcon name={glass || 'Coupe'} size={64} color={ds.c.sketchInk} />
    </View>
  );
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={ingredient ? `${accessibilityLabel}, drawing` : uri ? (generated ? `${accessibilityLabel}, sketch` : accessibilityLabel) : `${accessibilityLabel}, no photo yet`}
      style={[styles.frame, { aspectRatio, borderRadius, backgroundColor: (uri && placeholderColor) || ds.c.paper }, style]}
    >
      {ingredient ? (
        <IngredientDrawing id={ingredient.id} name={ingredient.name} />
      ) : uri ? (
        // Memory and disk: lists scroll the same pictures back into view. The
        // recycling key blanks a recycled list cell instead of flashing its last drink.
        <Image
          source={typeof shown === 'string' ? { uri: shown } : shown}
          style={styles.fill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={String(uri)}
          priority={priority}
          onError={
            small
              ? () => {
                  markNoThumb(uri as string);
                  setNoThumb(uri as string);
                }
              : undefined
          }
        />
      ) : itemId ? (
        <DrawnSketch itemId={itemId} fallback={glassIcon} animate={animate} detail={sketchDetail} />
      ) : (
        glassIcon
      )}
      {uri && generated && !hideTag ? <Tag label="Sketch" tone="sketch" style={styles.tag} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderCurve: 'continuous', width: '100%' },
  // Explicit rather than StyleSheet.absoluteFill: expo-image on native didn't
  // size itself from it under RN 0.86 (blank images in the gallery).
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  empty: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  tag: { position: 'absolute', right: space.sm, bottom: space.sm },
});
