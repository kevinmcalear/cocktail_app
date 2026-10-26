import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DrinkImage, useDs } from '@/components/ds';
import { withAlpha } from '@/lib/color';
import { bandLoopJump } from '@/lib/menus';
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
  /** Every drink, scrolled sideways, when there are more than fit (the menu page; Eddie, 14 Oct). Past the last it comes round to the first (E40). */
  scroll?: boolean;
}

/** How long the band must be still before a scroll past either end jumps back into the middle. */
const SETTLE_MS = 150;

/**
 * A menu's picture: its own photo, or with none, its first drinks side by
 * side, each its own photo or sketch. Nothing when it has neither. With
 * `scroll` and more drinks than fit, all of them, three and a half across,
 * coming round to the first again after the last.
 */
export function MenuVisual({ name, coverUrl, coverPosition = 50, pictures, height, fade, scroll }: MenuVisualProps) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const band = useRef<ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Never jumps under a finger: only once the band is let go and still.
  const dragging = useRef(false);
  const scrolls = scroll && !coverUrl && pictures.length > SHOWN;
  const shown = scrolls ? pictures : pictures.slice(0, SHOWN);
  const tile = width / (SHOWN - 0.5);
  // A loop: the last few drinks again before the first and the first few after the last. It opens on the first.
  const looped = scrolls ? [...pictures.slice(-SHOWN), ...pictures, ...pictures.slice(0, SHOWN)] : shown;
  useLayoutEffect(() => {
    if (scrolls && tile) band.current?.scrollTo({ x: SHOWN * tile, animated: false });
  }, [scrolls, tile]);
  useEffect(() => () => clearTimeout(settle.current), []);
  if (!coverUrl && !shown.length) return null;
  // Once it stops on a copy, the same drink in the middle, unseen.
  const onScroll = (x: number) => {
    clearTimeout(settle.current);
    if (dragging.current) return;
    settle.current = setTimeout(() => {
      const jump = bandLoopJump(x, tile, pictures.length, SHOWN);
      if (jump) band.current?.scrollTo({ x: x + jump, animated: false });
    }, SETTLE_MS);
  };
  const sketched = !coverUrl && shown.some((p) => !p.imageUrl || p.isSketch);
  const tiles = looped.map((p, i) => (
    // Faint ink dividers on the paper, and none under a fade (they ran on as dark lines through the title).
    <View
      key={`${i}:${p.id}`}
      style={[scrolls ? { width: tile, height } : styles.tile, i > 0 && !fade && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: withAlpha(ds.c.sketchInk, 0.18) }]}
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
          <ScrollView
            ref={band}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={tile}
            decelerationRate="fast"
            scrollEventThrottle={32}
            onScroll={(e) => onScroll(e.nativeEvent.contentOffset.x)}
            onScrollBeginDrag={() => (dragging.current = true)}
            onScrollEndDrag={(e) => {
              dragging.current = false;
              onScroll(e.nativeEvent.contentOffset.x);
            }}
          >
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
