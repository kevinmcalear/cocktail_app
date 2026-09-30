import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, GlassSurface, Tag, useDs } from '@/components/ds';
import { backbar, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { pictureLabel, pictureTag } from '@/lib/itemImages';

import { PicturePager } from './PicturePager';
import { PictureViewer, type ShownPicture } from './PictureViewer';

interface DrinkHeroProps {
  name: string;
  /** In orderedPictures order: the first is the hero. */
  pictures: ShownPicture[];
  glass: string | null;
  /** Colours from the photo (images.palette), once they exist. */
  palette?: string[] | null;
  height: number;
  /** Phone: the photo fades into the page. Wide: it sits in its own column. */
  fade: boolean;
}

/**
 * The drink's pictures, full bleed: swipe through them, tap one to open it
 * full screen. Until photos carry a palette, the field behind them is the page
 * ground; with one, the drink's own colour glows through (docs/design_system.md,
 * "Drink field").
 */
export function DrinkHero({ name, pictures, glass, palette, height, fade }: DrinkHeroProps) {
  const ds = useDs();
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const glow = palette?.[0] ? withAlpha(palette[0], ds.scheme === 'dark' ? 0.35 : 0.22) : null;
  // Not 'transparent': that is transparent black, and iOS blends through it as a grey band.
  const clear = withAlpha(ds.c.ground, 0);
  const total = pictures.length;
  const shown = pictures[Math.min(index, total - 1)];
  const tag = pictureTag(shown);
  // Clear of the fade (the page body overlaps the bottom of the hero on phones).
  const bottom = fade ? space.xxl + space.md : space.lg;

  return (
    <View style={{ height, backgroundColor: ds.c.paper }}>
      {total === 0 ? (
        <DrinkImage source={null} glass={glass} accessibilityLabel={name} radius={0} style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])} />
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
                accessibilityLabel={name}
                radius={0}
                hideTag
                style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])}
              />
            </Pressable>
          )}
        />
      )}
      {fade ? (
        <LinearGradient
          colors={[withAlpha(ds.c.ground, 0.35), clear, glow ?? clear, ds.c.ground]}
          locations={[0, 0.25, 0.7, 1]}
          style={styles.overlay}
        />
      ) : null}
      {total > 1 || tag ? (
        // Each page's label already says where it is and what it is; this is the visible copy.
        <View style={[styles.badges, { bottom }]} aria-hidden>
          {/* A solid ground behind the warning: the photo under it can be light or dark. */}
          {tag ? <Tag label={tag} tone={shown.isSketch ? 'sketch' : 'warning'} style={shown.isSketch ? undefined : { backgroundColor: ds.c.ground }} /> : null}
          {total > 1 ? (
            <GlassSurface scheme="dark" style={styles.count}>
              <Caption color={backbar.dark.ink}>{`${index + 1} of ${total}`}</Caption>
            </GlassSurface>
          ) : null}
        </View>
      ) : null}
      <PictureViewer pictures={pictures} name={name} open={viewing} startIndex={index} onClose={() => setViewing(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%' },
  page: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  badges: { position: 'absolute', right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, pointerEvents: 'none' },
  count: { paddingHorizontal: space.md, paddingVertical: space.xs },
});
