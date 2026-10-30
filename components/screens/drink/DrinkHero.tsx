import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, GlassButton, GlassSurface, Tag, useDs } from '@/components/ds';
import { backbar, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { withAlpha } from '@/lib/color';
import { pictureLabel, pictureTag } from '@/lib/itemImages';
import type { SketchInputs } from '@/lib/sketch/types';

import { PicturePager } from './PicturePager';
import { PictureViewer, type ShownPicture } from './PictureViewer';

interface DrinkHeroProps {
  name: string;
  /** In orderedPictures order: the first is the hero. */
  pictures: ShownPicture[];
  glass: string | null;
  /** The drink's id: with no pictures, its drawn sketch fills the hero. */
  itemId?: string | null;
  /** Colours from the photo (images.palette), once they exist. */
  palette?: string[] | null;
  height: number;
  /** Phone: the photo fades into the page. Wide: it sits in its own column. */
  fade: boolean;
  /** The editor: a Colour button on the drawing, to repaint it (SketchColourSheet). */
  onColour?: () => void;
  /** With no pictures: draw from these instead of the stored drawing (a beer or wine, lib/beerWineWizard.ts). */
  sketch?: SketchInputs | null;
  /** People who can edit it: a Photos button beside the count, to add, crop and choose the main photo (Eddie, 29 Oct). */
  onPhotos?: () => void;
}

/**
 * The phone hero's height: 30% of the screen below the status bar
 * (239 on a 390 x 844 phone). It was 22% so more of the spec fit on the first
 * screen (13 Oct), but the name kept covering the foot of the drink (27 Oct).
 * The page and its loading state share it.
 */
export function phoneHeroHeight(width: number, height: number, top: number) {
  return top + Math.min(width, (height - top) * 0.3);
}

/** How far the page body rides up over the hero on phones (DrinkScreen, BeerWineScreen, DrinkLoading). */
const OVERLAP = space.xxl;
/** The fade into the page: a short band at the foot of the picture, not a third of it. */
const FADE = OVERLAP + space.xxxl;
/** Ground's alpha along the fade, eased so it melts in rather than starting as a hard shelf. */
const EASE = [0, 0.08, 0.3, 0.65, 1];

/** The fade's colours and stops for a hero this tall: a light dim behind the top controls, then clear until the foot. */
function fadeStops(height: number, ground: string, glow: string | null) {
  const start = Math.max(0.5, 1 - FADE / height);
  const step = (1 - start) / (EASE.length - 1);
  const clear = withAlpha(ground, 0);
  return {
    colors: [withAlpha(ground, 0.35), clear, glow ?? clear, ...EASE.slice(1).map((a) => withAlpha(ground, a))] as const,
    locations: [0, 0.2, start, ...EASE.slice(1).map((_, i) => start + step * (i + 1))] as const,
  };
}

/**
 * The drink's pictures, full bleed: swipe through them, tap one to open it
 * full screen. Until photos carry a palette, the field behind them is the page
 * ground; with one, the drink's own colour glows through (docs/design_system.md,
 * "Drink field").
 */
export function DrinkHero({ name, pictures, glass, itemId, palette, height, fade, onColour, sketch, onPhotos }: DrinkHeroProps) {
  const ds = useDs();
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const glow = palette?.[0] ? withAlpha(palette[0], ds.scheme === 'dark' ? 0.35 : 0.22) : null;
  // Not 'transparent' (fadeStops): that is transparent black, and iOS blends through it as a grey band.
  const fadeTo = fadeStops(height, ds.c.ground, glow);
  const total = pictures.length;
  const shown = pictures[Math.min(index, total - 1)];
  const tag = pictureTag(shown);
  // Clear of the fade (the page body overlaps the bottom of the hero on phones).
  const bottom = fade ? OVERLAP + space.md : space.lg;
  // A drawing is square and scales to the hero's height: on phones, stop it above the name so its foot shows.
  const drawn = fade ? height - OVERLAP : height;

  return (
    <View style={{ height, backgroundColor: ds.c.paper }}>
      {total === 0 ? (
        <DrinkImage source={null} glass={glass} itemId={itemId} sketch={sketch} accessibilityLabel={name} radius={0} animate style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height: drawn }])} />
      ) : (
        <PicturePager
          count={total}
          index={index}
          onIndexChange={setIndex}
          renderPage={(i) => (
            <Pressable
              role="button"
              accessibilityLabel={`${name}, ${pictureLabel(pictures[i], i, total).toLowerCase()}. Open full screen`}
              onPress={() => {
                setIndex(i);
                setViewing(true);
              }}
              style={styles.page}
            >
              <DrinkImage
                source={pictures[i].url}
                generated={pictures[i].isSketch}
                glass={glass}
                placeholderColor={pictures[i].palette?.[0]}
                priority={i === 0 ? 'high' : 'normal'}
                accessibilityLabel={name}
                radius={0}
                style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])}
              />
            </Pressable>
          )}
        />
      )}
      {fade ? (
        <LinearGradient colors={fadeTo.colors} locations={fadeTo.locations} style={styles.overlay} />
      ) : null}
      {total > 1 || tag || onPhotos ? (
        <View style={[styles.badges, { bottom }]}>
          {/* Each page's label already says where it is and what it is; this is the visible copy. */}
          <View style={styles.marks} aria-hidden>
            {/* A solid ground behind the warning: the photo under it can be light or dark. */}
            {tag ? <Tag label={tag} tone="warning" style={{ backgroundColor: ds.c.ground }} /> : null}
            {total > 1 ? (
              <GlassSurface scheme="dark" style={styles.count}>
                <Caption color={backbar.dark.ink}>{`${index + 1} of ${total}`}</Caption>
              </GlassSurface>
            ) : null}
          </View>
          {onPhotos ? <GlassButton accessibilityLabel={total ? `Photos, ${total}: add, crop or choose the main one` : 'Add a photo'} icon="camera" label={total ? 'Photos' : 'Add a photo'} onMedia onPress={onPhotos} /> : null}
        </View>
      ) : null}
      {onColour && total === 0 && itemId ? <ColourButton itemId={itemId} name={name} bottom={bottom} onPress={onColour} /> : null}
      <PictureViewer pictures={pictures} name={name} open={viewing} startIndex={index} onClose={() => setViewing(false)} />
    </View>
  );
}

/** Only a drawn drink has a colour to change: the same query its drawing reads. */
function ColourButton({ itemId, name, bottom, onPress }: { itemId: string; name: string; bottom: number; onPress: () => void }) {
  if (!useItemSketch(itemId).data) return null;
  return (
    <View style={[styles.colour, { bottom }]}>
      <GlassButton accessibilityLabel={`Sketch colour, ${name}`} icon="paintpalette.fill" label="Colour" scheme="light" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
  page: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  badges: { position: 'absolute', right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, pointerEvents: 'box-none' },
  marks: { flexDirection: 'row', alignItems: 'center', gap: space.sm, pointerEvents: 'none' },
  colour: { position: 'absolute', left: space.lg },
  count: { paddingHorizontal: space.md, paddingVertical: space.xs },
});
