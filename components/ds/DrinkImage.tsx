import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius as radii } from '@/constants/tokens';
import { isPng } from '@/lib/itemImages';
import { bareGlassSketch } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';
import { copyToTry, markNoCopy } from '@/lib/thumbnails';

import { DrawnSketch } from './DrawnSketch';
import { SketchDrawing, type SketchDetail } from './SketchDrawing';
import { IngredientDrawing } from './IngredientDrawing';
import { useDs } from './theme';

export interface DrinkImageProps {
  /** A URL, or a bundled image (require). */
  source?: string | number | null;
  /** Drawn by the image generator, not photographed. Screen readers hear "sketch"; there's no visible tag (drawings are obviously drawings). */
  generated?: boolean;
  /** Glassware icon key (CustomIcons) drawn on paper when there's no image and no drawing yet. */
  glass?: string | null;
  /** The drink's id: with no image, it's drawn from its drawing inputs (item_sketches). */
  itemId?: string | null;
  /** What the image shows, for screen readers (usually the drink's name). */
  accessibilityLabel: string;
  /** Width over height; 0 to size by `style` alone. */
  aspectRatio?: number;
  radius?: keyof typeof radii | 0;
  style?: StyleProp<ViewStyle>;
  /** An ingredient instead of a drink: its picture as IngredientDrawing shows it (the drawing, its own photo, or plain paper), never `source`. */
  ingredient?: { id: string | null; name: string } | null;
  /**
   * List or grid size: the 480 px copy (lib/thumbnails.ts) instead of the
   * original, which can be 2-3 MB. Falls back to the original until the copy exists.
   * A drawing paints in an idle slice, not in the render that mounts the tile:
   * a full sketch is tens of ms on a phone, and a scrolled-in batch of tiles
   * painting at once stalled Library's scroll.
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
  /** With no image: draw from these inputs instead of the stored ones (beer and wine, lib/sketch/pour.ts). */
  sketch?: SketchInputs | null;
  /**
   * The photo's ThumbHash (images.thumbhash): painted while it loads, and it
   * says the 1080 px copy exists, so a page shows that instead of the original.
   */
  thumbhash?: string | null;
}

/**
 * A drink's picture. Never falls back to another drink's photo: with no image
 * yet, it shows a sketch drawn from the drink's own spec (glass, colour, ice,
 * foam, garnish), or until that exists, its bare glass. A photo sits in its
 * frame; a drawing has no card behind it (decision chrome).
 */
export function DrinkImage({ source, generated, glass, itemId, accessibilityLabel, aspectRatio = 1, radius = 'card', style, ingredient, thumb = false, animate, sketchDetail, placeholderColor, priority, sketch, thumbhash }: DrinkImageProps) {
  const ds = useDs();
  const borderRadius = radius === 0 ? 0 : radii[radius];
  const uri = ingredient ? null : (source ?? null);
  // The list copy, or the page copy once the row says it was made (thumbhash);
  // the original whose copy failed here, which copyToTry remembers past this mount.
  // Read in the condition so the compiler recomputes `copy` when it changes.
  const size = thumb ? 'thumb' : 'page';
  const [noCopy, setNoCopy] = useState<string | null>(null);
  const copy = typeof uri === 'string' && noCopy !== uri ? copyToTry(uri, size, !!thumbhash) : null;
  const shown = copy ?? uri;
  // A cut-out sits on the house paper, not on its own colour, which it would vanish into.
  const cutout = isPng(uri);
  // No drawing yet (or still loading): the bare glass, drawn as the drawings are, not a small line icon (i-glass-pic).
  const bare = useMemo(() => bareGlassSketch(glass), [glass]);
  const glassIcon = (
    <View style={styles.fill}>
      <SketchDrawing inputs={bare} seed={glass || 'Coupe'} detail={sketchDetail ?? (thumb ? 'thumb' : 'full')} lazy={thumb || sketchDetail === 'thumb'} />
    </View>
  );
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={ingredient ? accessibilityLabel : uri ? (generated ? `${accessibilityLabel}, sketch` : accessibilityLabel) : `${accessibilityLabel}, no photo yet`}
      style={[styles.frame, { aspectRatio: aspectRatio || undefined, borderRadius, backgroundColor: uri ? (!cutout && placeholderColor) || ds.c.paper : undefined }, style]}
    >
      {ingredient ? (
        <IngredientDrawing id={ingredient.id} name={ingredient.name} lazy={thumb} />
      ) : uri ? (
        // Memory and disk: lists scroll the same pictures back into view. The
        // recycling key blanks a recycled list cell instead of flashing its last drink.
        <Image
          source={typeof shown === 'string' ? { uri: shown } : shown}
          // Its blur while the photo loads (images.thumbhash).
          placeholder={thumbhash ? { thumbhash } : undefined}
          style={styles.fill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={String(uri)}
          priority={priority}
          onError={
            copy
              ? () => {
                  markNoCopy(uri as string, size);
                  setNoCopy(uri as string);
                }
              : undefined
          }
        />
      ) : sketch ? (
        <View style={styles.fill}>
          <SketchDrawing inputs={sketch} seed={itemId ?? accessibilityLabel} detail={sketchDetail} lazy={thumb || sketchDetail === 'thumb'} />
        </View>
      ) : itemId ? (
        <DrawnSketch itemId={itemId} fallback={glassIcon} animate={animate} detail={sketchDetail} lazy={thumb || sketchDetail === 'thumb'} />
      ) : (
        glassIcon
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderCurve: 'continuous', width: '100%' },
  // Explicit rather than StyleSheet.absoluteFill: expo-image on native didn't
  // size itself from it under RN 0.86 (blank images in the gallery).
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
