import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DrinkImage, useDs } from '@/components/ds';
import { withAlpha } from '@/lib/color';
import type { MenuPicture } from '@/types/menus';

/** Drinks side by side in the band; with more, the next one is cut at the edge so it's clear the band scrolls. */
const SHOWN = 4;

interface MenuVisualProps {
  name: string;
  coverUrl: string | null;
  coverPosition?: number;
  /** The menu's drinks, the first side by side when it has no cover. */
  pictures: MenuPicture[];
  height: number;
  /** Fades into the page below (the menu page on phones). */
  fade?: boolean;
  /** Every drink, scrolled sideways, when there are more than fit (the menu page; Eddie, 14 Oct). */
  scroll?: boolean;
}

/**
 * A menu's picture: its own photo, or with none, its first drinks side by
 * side, each its own photo or sketch. Nothing when it has neither. With
 * `scroll` and more drinks than fit, all of them, three and a half across.
 */
export function MenuVisual({ name, coverUrl, coverPosition = 50, pictures, height, fade, scroll }: MenuVisualProps) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const scrolls = scroll && !coverUrl && pictures.length > SHOWN;
  const shown = scrolls ? pictures : pictures.slice(0, SHOWN);
  if (!coverUrl && !shown.length) return null;
  const sketched = !coverUrl && shown.some((p) => !p.imageUrl || p.isSketch);
  const tiles = shown.map((p, i) => (
    // Faint ink dividers on the paper, and none under a fade (they ran on as dark lines through the title).
    <View
      key={p.id}
      style={[scrolls ? { width: width / (SHOWN - 0.5), height } : styles.tile, i > 0 && !fade && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: withAlpha(ds.c.sketchInk, 0.18) }]}
    >
      <DrinkImage
        source={p.imageUrl}
        generated={p.isSketch}
        itemId={p.id}
        accessibilityLabel={p.name}
        radius={0}
        style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])}
      />
    </View>
  ));
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={coverUrl ? `${name}, cover photo` : `${name}: ${shown.map((p) => p.name).join(', ')}${sketched ? ', sketches' : ''}`}
      onLayout={scrolls ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}
      style={[styles.frame, { height, backgroundColor: ds.c.paper }]}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} contentFit="cover" contentPosition={{ top: `${coverPosition}%`, left: '50%' }} style={styles.fill} />
      ) : scrolls ? (
        // Measured first, so each drink is a share of the band.
        width ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width / (SHOWN - 0.5)} decelerationRate="fast">
            {tiles}
          </ScrollView>
        ) : null
      ) : (
        tiles
      )}
      {/* The board's stops (venue-menus-menu): a light shade for the top buttons, clear through the middle, then the page. */}
      {fade ? (
        <LinearGradient
          colors={[withAlpha(ds.c.ground, 0.45), withAlpha(ds.c.ground, 0), withAlpha(ds.c.ground, 0), ds.c.ground]}
          locations={[0, 0.26, 0.5, 1]}
          style={styles.fill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  tile: { flex: 1 },
});
